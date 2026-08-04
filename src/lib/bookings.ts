import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { WeekBooking } from "./booking-types";
import { TIMEZONE } from "./config";
import { getDataDir } from "./data-dir";
import { getSupabase, isSupabaseConfigured } from "./supabase";

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

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string;
  client_name: string;
  client_phone: string | null;
  email: string | null;
  services_label: string | null;
  duration_minutes: number | null;
  is_new_client: boolean;
  same_device: boolean;
  non_swiss_phone: boolean;
  generated_phone: boolean;
  disposable_email: boolean;
  device_id: string | null;
  summary: string;
  created_at: string;
  google_event_id: string | null;
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

function rowToBooking(row: BookingRow): StoredBooking {
  return {
    id: row.id,
    start: row.start_at,
    end: row.end_at,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    email: row.email,
    servicesLabel: row.services_label,
    durationMinutes: row.duration_minutes,
    isNewClient: row.is_new_client,
    sameDevice: row.same_device,
    nonSwissPhone: row.non_swiss_phone,
    generatedPhone: row.generated_phone,
    disposableEmail: row.disposable_email,
    deviceId: row.device_id,
    summary: row.summary,
    createdAt: row.created_at,
    googleEventId: row.google_event_id,
  };
}

function bookingToRow(b: StoredBooking): BookingRow {
  return {
    id: b.id,
    start_at: b.start,
    end_at: b.end,
    client_name: b.clientName,
    client_phone: b.clientPhone,
    email: b.email,
    services_label: b.servicesLabel,
    duration_minutes: b.durationMinutes,
    is_new_client: b.isNewClient,
    same_device: b.sameDevice,
    non_swiss_phone: b.nonSwissPhone,
    generated_phone: b.generatedPhone,
    disposable_email: b.disposableEmail,
    device_id: b.deviceId,
    summary: b.summary,
    created_at: b.createdAt,
    google_event_id: b.googleEventId ?? null,
  };
}

async function readBookingsFile(): Promise<StoredBooking[]> {
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

async function writeBookingsFile(bookings: StoredBooking[]): Promise<void> {
  await ensureFile();
  const { FILE_PATH } = dataPaths();
  const sorted = [...bookings].sort((a, b) => a.start.localeCompare(b.start));
  await fs.writeFile(
    FILE_PATH,
    `${JSON.stringify(sorted, null, 2)}\n`,
    "utf8",
  );
}

async function readBookingsDb(): Promise<StoredBooking[]> {
  const { data, error } = await getSupabase()
    .from("bookings")
    .select("*")
    .order("start_at", { ascending: true });
  if (error) throw new Error(`Supabase bookings: ${error.message}`);
  return ((data ?? []) as BookingRow[]).map(rowToBooking);
}

export async function readBookings(): Promise<StoredBooking[]> {
  if (isSupabaseConfigured()) return readBookingsDb();
  return readBookingsFile();
}

async function writeBookings(bookings: StoredBooking[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    await writeBookingsFile(bookings);
    return;
  }
  const sb = getSupabase();
  const { error: delErr } = await sb
    .from("bookings")
    .delete()
    .not("id", "is", null);
  if (delErr) throw new Error(`Supabase bookings clear: ${delErr.message}`);
  if (bookings.length === 0) return;
  const { error } = await sb.from("bookings").insert(bookings.map(bookingToRow));
  if (error) throw new Error(`Supabase bookings write: ${error.message}`);
}

/** Remplace tout le fichier / table (migration / seed). */
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
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("bookings")
      .select("start_at, end_at")
      .lt("start_at", timeMax)
      .gt("end_at", timeMin);
    if (error) throw new Error(`Supabase busy: ${error.message}`);
    return ((data ?? []) as { start_at: string; end_at: string }[]).map(
      (r) => ({ start: r.start_at, end: r.end_at }),
    );
  }

  const min = dayjs(timeMin);
  const max = dayjs(timeMax);
  const bookings = await readBookingsFile();
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
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("bookings")
      .select("*")
      .gte("start_at", timeMin)
      .lt("start_at", timeMax)
      .order("start_at", { ascending: true });
    if (error) throw new Error(`Supabase week: ${error.message}`);
    return ((data ?? []) as BookingRow[]).map(rowToBooking).map(toWeekBooking);
  }

  const min = dayjs(timeMin);
  const max = dayjs(timeMax);
  const bookings = await readBookingsFile();
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

  if (isSupabaseConfigured()) {
    const { error } = await getSupabase()
      .from("bookings")
      .insert(bookingToRow(booking));
    if (error) throw new Error(`Supabase create booking: ${error.message}`);
    return { id: booking.id, htmlLink: null };
  }

  const all = await readBookingsFile();
  all.push(booking);
  await writeBookingsFile(all);
  return { id: booking.id, htmlLink: null };
}

export async function deleteBookingEvent(eventId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("bookings")
      .delete()
      .eq("id", eventId)
      .select("id");
    if (error) throw new Error(`Supabase delete booking: ${error.message}`);
    if (!data?.length) throw new Error("Rendez-vous introuvable.");
    return;
  }

  const all = await readBookingsFile();
  const next = all.filter((b) => b.id !== eventId);
  if (next.length === all.length) {
    throw new Error("Rendez-vous introuvable.");
  }
  await writeBookingsFile(next);
}

/** Affichage Zurich pour logs / migration. */
export function formatBookingDay(iso: string): string {
  return dayjs(iso).tz(TIMEZONE).format("YYYY-MM-DD HH:mm");
}
