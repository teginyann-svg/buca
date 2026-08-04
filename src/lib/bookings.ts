import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { WeekBooking } from "./booking-types";
import { TIMEZONE } from "./config";
import { getDataDir } from "./data-dir";

dayjs.extend(utc);
dayjs.extend(timezone);

export type StoredBooking = {
  id: string;
  start: string;
  end: string;
  clientName: string;
  clientPhone: string | null;
  email: string | null;
  servicesLabel: string | null;
  durationMinutes: number | null;
  isNewClient: boolean;
  sameDevice: boolean;
  nonSwissPhone: boolean;
  generatedPhone: boolean;
  disposableEmail: boolean;
  deviceId: string | null;
  summary: string;
  createdAt: string;
  /** Provenance migration Google, si applicable. */
  googleEventId?: string | null;
};

export type CreateStoredBookingInput = {
  start: string;
  end: string;
  clientName: string;
  clientPhone: string;
  email?: string | null;
  deviceId?: string | null;
  servicesLabel?: string;
  durationMinutes?: number;
  isNewClient?: boolean;
  sameDevice?: boolean;
  nonSwissPhone?: boolean;
  generatedPhone?: boolean;
  disposableEmail?: boolean;
};

function dataPaths() {
  const DATA_DIR = getDataDir();
  return {
    DATA_DIR,
    FILE_PATH: path.join(DATA_DIR, "bookings.json"),
    BUNDLED: path.join(process.cwd(), "data", "bookings.json"),
  };
}

async function ensureFile(): Promise<void> {
  const { DATA_DIR, FILE_PATH, BUNDLED } = dataPaths();
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    try {
      await fs.copyFile(BUNDLED, FILE_PATH);
    } catch {
      await fs.writeFile(FILE_PATH, "[]\n", "utf8");
    }
  }
}

function normalizeBooking(row: Record<string, unknown>): StoredBooking | null {
  if (typeof row.id !== "string" || !row.id) return null;
  if (typeof row.start !== "string" || typeof row.end !== "string") return null;
  if (typeof row.clientName !== "string") return null;
  return {
    id: row.id,
    start: row.start,
    end: row.end,
    clientName: row.clientName,
    clientPhone: typeof row.clientPhone === "string" ? row.clientPhone : null,
    email: typeof row.email === "string" ? row.email : null,
    servicesLabel:
      typeof row.servicesLabel === "string" ? row.servicesLabel : null,
    durationMinutes:
      typeof row.durationMinutes === "number" ? row.durationMinutes : null,
    isNewClient: Boolean(row.isNewClient),
    sameDevice: Boolean(row.sameDevice),
    nonSwissPhone: Boolean(row.nonSwissPhone),
    generatedPhone: Boolean(row.generatedPhone),
    disposableEmail: Boolean(row.disposableEmail),
    deviceId: typeof row.deviceId === "string" ? row.deviceId : null,
    summary:
      typeof row.summary === "string" && row.summary.trim()
        ? row.summary
        : `Réservation — ${row.clientName}`,
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : new Date().toISOString(),
    googleEventId:
      typeof row.googleEventId === "string" ? row.googleEventId : null,
  };
}

export async function readBookings(): Promise<StoredBooking[]> {
  await ensureFile();
  const { FILE_PATH } = dataPaths();
  const raw = await fs.readFile(FILE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) =>
        row && typeof row === "object"
          ? normalizeBooking(row as Record<string, unknown>)
          : null,
      )
      .filter((row): row is StoredBooking => row !== null)
      .sort((a, b) => a.start.localeCompare(b.start));
  } catch {
    return [];
  }
}

async function writeBookings(bookings: StoredBooking[]): Promise<void> {
  await ensureFile();
  const { FILE_PATH } = dataPaths();
  const sorted = [...bookings].sort((a, b) => a.start.localeCompare(b.start));
  await fs.writeFile(
    FILE_PATH,
    `${JSON.stringify(sorted, null, 2)}\n`,
    "utf8",
  );
}

/** Remplace tout le fichier (migration). */
export async function replaceAllBookings(
  bookings: StoredBooking[],
): Promise<number> {
  await writeBookings(bookings);
  return bookings.length;
}

export async function fetchBusyIntervals(
  timeMin: string,
  timeMax: string,
): Promise<{ start: string; end: string }[]> {
  const min = dayjs(timeMin);
  const max = dayjs(timeMax);
  const bookings = await readBookings();
  return bookings
    .filter((b) => {
      const start = dayjs(b.start);
      const end = dayjs(b.end);
      return start.isBefore(max) && end.isAfter(min);
    })
    .map((b) => ({ start: b.start, end: b.end }));
}

export async function listWeekBookings(
  timeMin: string,
  timeMax: string,
): Promise<WeekBooking[]> {
  const min = dayjs(timeMin);
  const max = dayjs(timeMax);
  const bookings = await readBookings();
  return bookings
    .filter((b) => {
      const start = dayjs(b.start);
      return (
        (start.isAfter(min) || start.isSame(min)) && start.isBefore(max)
      );
    })
    .map(toWeekBooking);
}

function toWeekBooking(b: StoredBooking): WeekBooking {
  return {
    id: b.id,
    clientName: b.clientName,
    clientPhone: b.clientPhone,
    start: b.start,
    end: b.end,
    summary: b.summary,
    servicesLabel: b.servicesLabel,
    durationMinutes: b.durationMinutes,
    isNewClient: b.isNewClient,
    sameDevice: b.sameDevice,
    nonSwissPhone: b.nonSwissPhone,
    generatedPhone: b.generatedPhone,
    disposableEmail: b.disposableEmail,
    deviceId: b.deviceId,
    email: b.email,
  };
}

export async function createBookingEvent(
  input: CreateStoredBookingInput,
): Promise<{ id: string; htmlLink?: string | null }> {
  const tags: string[] = [];
  if (input.isNewClient) tags.push("Nouvelle cliente");
  if (input.sameDevice) tags.push("Provient d’un même appareil");
  if (input.nonSwissPhone) tags.push("N° non-suisse");
  if (input.generatedPhone) tags.push("N° généré");
  if (input.disposableEmail) tags.push("Email jetable");

  const summaryParts = [`Réservation — ${input.clientName}`, ...tags];
  if (input.servicesLabel) summaryParts.push(input.servicesLabel);

  const booking: StoredBooking = {
    id: randomUUID(),
    start: input.start,
    end: input.end,
    clientName: input.clientName.trim(),
    clientPhone: input.clientPhone.trim() || null,
    email: input.email?.trim() || null,
    servicesLabel: input.servicesLabel?.trim() || null,
    durationMinutes: input.durationMinutes ?? null,
    isNewClient: Boolean(input.isNewClient),
    sameDevice: Boolean(input.sameDevice),
    nonSwissPhone: Boolean(input.nonSwissPhone),
    generatedPhone: Boolean(input.generatedPhone),
    disposableEmail: Boolean(input.disposableEmail),
    deviceId: input.deviceId ?? null,
    summary: summaryParts.join(" · "),
    createdAt: new Date().toISOString(),
    googleEventId: null,
  };

  const all = await readBookings();
  all.push(booking);
  await writeBookings(all);
  return { id: booking.id, htmlLink: null };
}

export async function deleteBookingEvent(eventId: string): Promise<void> {
  const all = await readBookings();
  const next = all.filter((b) => b.id !== eventId);
  if (next.length === all.length) {
    throw new Error("Rendez-vous introuvable.");
  }
  await writeBookings(next);
}

/** Affichage Zurich pour logs / migration. */
export function formatBookingDay(iso: string): string {
  return dayjs(iso).tz(TIMEZONE).format("YYYY-MM-DD HH:mm");
}
