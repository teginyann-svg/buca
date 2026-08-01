import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { promises as fs } from "node:fs";
import path from "node:path";
import { TIMEZONE } from "./config";
import { getDataDir } from "./data-dir";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);

function filePath(): string {
  return path.join(getDataDir(), "device-bookings.json");
}

async function ensureFile(): Promise<void> {
  const DATA_DIR = getDataDir();
  const FILE_PATH = filePath();
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    const bundled = path.join(process.cwd(), "data", "device-bookings.json");
    try {
      await fs.copyFile(bundled, FILE_PATH);
    } catch {
      await fs.writeFile(FILE_PATH, "{}\n", "utf8");
    }
  }
}
/** 2e réservation depuis le même appareil → marquage « Provient d’un même appareil ». */
export const SAME_DEVICE_BOOKING_THRESHOLD = 2;

/** Seuil jour → confirmation « Êtes-vous sûr(e)… ». */
export const MAX_DEVICE_BOOKINGS_PER_DAY = 1;

/** Seuil semaine → confirmation (3e RDV). */
export const MAX_DEVICE_BOOKINGS_PER_WEEK = 2;

/** Fenêtre « temps court » (minutes) — pas de refus, marquage seulement. */
export const SHORT_WINDOW_MINUTES = 60;

export type DeviceSeverity = "none" | "same_device";

export type DeviceBookingEntry = {
  at: string;
  visitDate: string;
  eventId: string | null;
  phone: string;
};

export type DeviceRecord = {
  count: number;
  bookings: DeviceBookingEntry[];
};

export type DeviceLimitResult = {
  /** Toujours true hors confirmation (jamais de blocage dur). */
  allowed: boolean;
  needsConfirmation: boolean;
  /** Marquer « Provient d’un même appareil » si la résa est acceptée. */
  severity: DeviceSeverity;
  reason: "day" | "week" | null;
  message: string | null;
  dayCount: number;
  weekCount: number;
  recentCount: number;
  totalCount: number;
};

type DeviceStore = Record<string, DeviceRecord>;

async function readStore(): Promise<DeviceStore> {
  await ensureFile();
  const raw = await fs.readFile(filePath(), "utf8");
  try {
    const parsed = JSON.parse(raw) as DeviceStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: DeviceStore): Promise<void> {
  await ensureFile();
  await fs.writeFile(
    filePath(),
    `${JSON.stringify(store, null, 2)}\n`,
    "utf8",
  );
}

function visitDayKey(visitDate: string): string {
  return dayjs.tz(visitDate, TIMEZONE).format("YYYY-MM-DD");
}

function visitWeekKey(visitDate: string): string {
  const d = dayjs.tz(visitDate, TIMEZONE);
  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, "0")}`;
}

function entryVisitDate(entry: DeviceBookingEntry): string {
  if (entry.visitDate) return entry.visitDate;
  return dayjs(entry.at).tz(TIMEZONE).format("YYYY-MM-DD");
}

function minutesSince(isoAt: string, now: dayjs.Dayjs): number {
  return now.diff(dayjs(isoAt), "minute");
}

export function severityForAcceptedBooking(input: {
  dayCount: number;
  weekCount: number;
  totalCount: number;
}): DeviceSeverity {
  if (input.dayCount >= 1) return "same_device";
  if (input.weekCount >= 1) return "same_device";
  if (input.totalCount + 1 >= SAME_DEVICE_BOOKING_THRESHOLD) {
    return "same_device";
  }
  return "none";
}

export async function getDeviceBookingCount(deviceId: string): Promise<number> {
  const store = await readStore();
  return store[deviceId]?.count ?? 0;
}

export async function isSameDeviceRepeat(deviceId: string): Promise<boolean> {
  const count = await getDeviceBookingCount(deviceId);
  return count >= SAME_DEVICE_BOOKING_THRESHOLD;
}

/** @deprecated utiliser isSameDeviceRepeat */
export async function isDeviceSuspect(deviceId: string): Promise<boolean> {
  return isSameDeviceRepeat(deviceId);
}

export async function getDeviceSeverityHint(
  deviceId: string,
  visitDate: string,
): Promise<DeviceSeverity> {
  const store = await readStore();
  const record = store[deviceId.trim()];
  if (!record) return "none";
  const dayKey = visitDayKey(visitDate);
  const weekKey = visitWeekKey(visitDate);
  let dayCount = 0;
  let weekCount = 0;
  for (const entry of record.bookings) {
    const vd = entryVisitDate(entry);
    if (visitDayKey(vd) === dayKey) dayCount += 1;
    if (visitWeekKey(vd) === weekKey) weekCount += 1;
  }
  return severityForAcceptedBooking({
    dayCount,
    weekCount,
    totalCount: record.count,
  });
}

function dayCeilingConfirmMessage(dayCount: number): string {
  const n = dayCount;
  const label =
    n <= 1
      ? "déjà 1 réservation le même jour"
      : `déjà ${n} réservations le même jour`;
  return `Êtes-vous sûr(e) ? Cela fait ${label} depuis cet appareil.`;
}

function weekCeilingConfirmMessage(weekCount: number): string {
  const n = weekCount;
  const label =
    n <= 1
      ? "déjà 1 réservation la même semaine"
      : `déjà ${n} réservations la même semaine`;
  return `Êtes-vous sûr(e) ? Cela fait ${label} depuis cet appareil.`;
}

/**
 * Aucun blocage dur.
 * Plafonds jour / semaine → confirmation (sauf si déjà confirmé, ou cliente connue).
 * Cliente dans le fichier : plusieurs RDV OK sans modale (même appareil est normal).
 * Répétition courte → acceptée avec marquage même appareil.
 */
export async function evaluateDeviceBookingLimit(input: {
  deviceId: string;
  visitDate: string;
  now?: dayjs.Dayjs;
  confirmedCeiling?: boolean;
  /** Numéro déjà dans data/clients.json → pas de confirmation plafonds. */
  knownClient?: boolean;
}): Promise<DeviceLimitResult> {
  const deviceId = input.deviceId.trim();
  const empty: DeviceLimitResult = {
    allowed: true,
    needsConfirmation: false,
    severity: "none",
    reason: null,
    message: null,
    dayCount: 0,
    weekCount: 0,
    recentCount: 0,
    totalCount: 0,
  };

  if (!deviceId || deviceId.length > 80) return empty;

  const now = input.now ?? dayjs();
  const store = await readStore();
  const record = store[deviceId] ?? { count: 0, bookings: [] };
  const dayKey = visitDayKey(input.visitDate);
  const weekKey = visitWeekKey(input.visitDate);

  let dayCount = 0;
  let weekCount = 0;
  let recentCount = 0;

  for (const entry of record.bookings) {
    const vd = entryVisitDate(entry);
    if (visitDayKey(vd) === dayKey) dayCount += 1;
    if (visitWeekKey(vd) === weekKey) weekCount += 1;

    const elapsed = minutesSince(entry.at, now);
    if (elapsed >= 0 && elapsed < SHORT_WINDOW_MINUTES) {
      recentCount += 1;
    }
  }

  const totalCount = record.count;
  const severity = severityForAcceptedBooking({
    dayCount,
    weekCount,
    totalCount,
  });

  const skipCeilingConfirm =
    Boolean(input.confirmedCeiling) || Boolean(input.knownClient);

  if (!skipCeilingConfirm && dayCount >= MAX_DEVICE_BOOKINGS_PER_DAY) {
    return {
      allowed: false,
      needsConfirmation: true,
      severity: "same_device",
      reason: "day",
      message: dayCeilingConfirmMessage(dayCount),
      dayCount,
      weekCount,
      recentCount,
      totalCount,
    };
  }

  if (!skipCeilingConfirm && weekCount >= MAX_DEVICE_BOOKINGS_PER_WEEK) {
    return {
      allowed: false,
      needsConfirmation: true,
      severity: "same_device",
      reason: "week",
      message: weekCeilingConfirmMessage(weekCount),
      dayCount,
      weekCount,
      recentCount,
      totalCount,
    };
  }

  return {
    allowed: true,
    needsConfirmation: false,
    severity: recentCount >= 1 ? "same_device" : severity,
    reason: null,
    message: null,
    dayCount,
    weekCount,
    recentCount,
    totalCount,
  };
}

export async function recordDeviceBooking(input: {
  deviceId: string;
  phone: string;
  visitDate: string;
  eventId?: string | null;
}): Promise<{ count: number; severity: DeviceSeverity }> {
  const deviceId = input.deviceId.trim();
  if (!deviceId || deviceId.length > 80) {
    return { count: 0, severity: "none" };
  }

  const store = await readStore();
  const prev = store[deviceId] ?? { count: 0, bookings: [] };
  const visitDate = input.visitDate;
  const dayKey = visitDayKey(visitDate);
  const weekKey = visitWeekKey(visitDate);

  let dayCount = 0;
  let weekCount = 0;
  for (const entry of prev.bookings) {
    const vd = entryVisitDate(entry);
    if (visitDayKey(vd) === dayKey) dayCount += 1;
    if (visitWeekKey(vd) === weekKey) weekCount += 1;
  }

  const next: DeviceRecord = {
    count: prev.count + 1,
    bookings: [
      ...prev.bookings,
      {
        at: new Date().toISOString(),
        visitDate,
        eventId: input.eventId ?? null,
        phone: input.phone,
      },
    ],
  };
  store[deviceId] = next;
  await writeStore(store);

  return {
    count: next.count,
    severity: severityForAcceptedBooking({
      dayCount,
      weekCount,
      totalCount: prev.count,
    }),
  };
}
