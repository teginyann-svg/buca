import { google } from "googleapis";
import { CALENDAR_ID, SALON_LOCATION, TIMEZONE } from "./config";
import type { WeekBooking } from "./booking-types";

export type { WeekBooking } from "./booking-types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable manquante : ${name}. Voir .env.example et le README.`,
    );
  }
  return value;
}

export function getOAuth2Client() {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const refreshToken = requireEnv("GOOGLE_REFRESH_TOKEN");

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

export function getCalendarClient() {
  return google.calendar({ version: "v3", auth: getOAuth2Client() });
}

export async function fetchBusyIntervals(
  timeMin: string,
  timeMax: string,
): Promise<{ start: string; end: string }[]> {
  const calendar = getCalendarClient();
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone: TIMEZONE,
      items: [{ id: CALENDAR_ID }],
    },
  });

  const cal = response.data.calendars?.[CALENDAR_ID];
  if (!cal) {
    throw new Error(
      `Agenda « ${CALENDAR_ID} » introuvable ou inaccessible avec le compte Google configuré.`,
    );
  }
  if (cal.errors?.length) {
    throw new Error(
      `Erreur Google Agenda (disponibilités) : ${cal.errors
        .map((e) => e.reason ?? "inconnue")
        .join(", ")}`,
    );
  }

  return (cal.busy ?? [])
    .filter((b): b is { start: string; end: string } =>
      Boolean(b.start && b.end),
    )
    .map((b) => ({ start: b.start, end: b.end }));
}

export type CreateBookingInput = {
  start: string;
  end: string;
  clientName: string;
  clientPhone: string;
  servicesLabel?: string;
  durationMinutes?: number;
  email?: string | null;
  deviceId?: string | null;
  isNewClient?: boolean;
  sameDevice?: boolean;
  nonSwissPhone?: boolean;
  generatedPhone?: boolean;
  disposableEmail?: boolean;
};

export async function createBookingEvent(input: CreateBookingInput) {
  const calendar = getCalendarClient();

  const tags: string[] = [];
  if (input.isNewClient) tags.push("Nouvelle cliente");
  if (input.sameDevice) tags.push("Provient d’un même appareil");
  if (input.nonSwissPhone) tags.push("N° non-suisse");
  if (input.generatedPhone) tags.push("N° généré");
  if (input.disposableEmail) tags.push("Email jetable");

  const summaryParts = [`Réservation — ${input.clientName}`, ...tags];
  if (input.servicesLabel) {
    summaryParts.push(input.servicesLabel);
  }

  const response = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: summaryParts.join(" · "),
      description: [
        `Cliente : ${input.clientName}`,
        `Téléphone : ${input.clientPhone}`,
        input.email ? `Email : ${input.email}` : null,
        input.servicesLabel ? `Services : ${input.servicesLabel}` : null,
        input.durationMinutes
          ? `Durée : ${input.durationMinutes} min`
          : null,
        input.isNewClient ? `Signalement : Nouvelle cliente` : null,
        input.sameDevice
          ? `Signalement : Provient d’un même appareil`
          : null,
        input.nonSwissPhone ? `Signalement : N° non-suisse` : null,
        input.generatedPhone ? `Signalement : N° généré` : null,
        input.disposableEmail ? `Signalement : Email jetable` : null,
        input.deviceId ? `Appareil : ${input.deviceId}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      location: SALON_LOCATION,
      start: {
        dateTime: input.start,
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: input.end,
        timeZone: TIMEZONE,
      },
    },
  });

  return response.data;
}

function parseBookingFromEvent(event: {
  id?: string | null;
  summary?: string | null;
  description?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
}): WeekBooking | null {
  if (!event.id || !event.start?.dateTime || !event.end?.dateTime) {
    return null;
  }

  const summary = event.summary?.trim() || "Sans titre";
  const description = event.description ?? "";

  const nameFromSummary = summary.match(/^Réservation\s*[—–-]\s*([^·]+)/i)?.[1]
    ?.trim();
  const nameFromDesc =
    description.match(/Client(?:e)?\s*:\s*(.+)/i)?.[1]?.trim();
  const phoneFromDesc =
    description.match(/Téléphone\s*:\s*(.+)/i)?.[1]?.trim() ?? null;
  const emailFromDesc =
    description.match(/Email\s*:\s*(.+)/i)?.[1]?.trim() ?? null;
  const servicesFromDesc =
    description.match(/Services\s*:\s*(.+)/i)?.[1]?.trim() ?? null;
  const durationFromDesc = description.match(/Durée\s*:\s*(\d+)\s*min/i)?.[1];
  const deviceId =
    description.match(/Appareil\s*:\s*([^\s\n]+)/i)?.[1]?.trim() ?? null;

  const signalements = [
    ...description.matchAll(/Signalement\s*:\s*(.+)/gi),
  ].map((m) => m[1].trim().toLowerCase());

  const isNewClient =
    signalements.some((s) => s.includes("nouvelle")) ||
    /nouvelle cliente/i.test(summary);
  const sameDevice =
    signalements.some(
      (s) =>
        s.includes("même appareil") ||
        s.includes("meme appareil") ||
        s.includes("provient"),
    ) ||
    /provient d[’']un même appareil|même appareil|meme appareil/i.test(
      summary,
    ) ||
    // Anciens marquages Agenda
    /très suspect|tres suspect|\bsuspect\b/i.test(summary) ||
    signalements.some(
      (s) => s.includes("suspect") || s.includes("très suspect"),
    );
  const nonSwissPhone =
    signalements.some(
      (s) =>
        s.includes("non-suisse") ||
        s.includes("non suisse") ||
        s.includes("n° non"),
    ) || /n[°o]\s*non-suisse|non-suisse/i.test(summary);
  const generatedPhone =
    signalements.some(
      (s) => s.includes("n° généré") || s.includes("n° genere") || s.includes("generé") || s.includes("généré"),
    ) || /n[°o]\s*généré|n[°o]\s*genere/i.test(summary);
  const disposableEmail =
    signalements.some(
      (s) => s.includes("email jetable") || s.includes("jetable"),
    ) || /email jetable/i.test(summary);

  const startMs = Date.parse(event.start.dateTime);
  const endMs = Date.parse(event.end.dateTime);
  const durationFromTimes =
    Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
      ? Math.round((endMs - startMs) / 60000)
      : null;

  return {
    id: event.id,
    clientName: nameFromSummary || nameFromDesc || summary,
    clientPhone: phoneFromDesc,
    start: event.start.dateTime,
    end: event.end.dateTime,
    summary,
    servicesLabel: servicesFromDesc,
    durationMinutes: durationFromDesc
      ? Number(durationFromDesc)
      : durationFromTimes,
    isNewClient,
    sameDevice,
    nonSwissPhone,
    generatedPhone,
    disposableEmail,
    deviceId,
    email: emailFromDesc,
  };
}

/** Timed events for [timeMin, timeMax), ordered by start. */
export async function listWeekBookings(
  timeMin: string,
  timeMax: string,
): Promise<WeekBooking[]> {
  const calendar = getCalendarClient();
  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  return (response.data.items ?? [])
    .map((event) => parseBookingFromEvent(event))
    .filter((b): b is WeekBooking => b !== null);
}

export async function deleteBookingEvent(eventId: string): Promise<void> {
  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId,
  });
}

/** Scopes needed for freeBusy + create/list/delete events. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];
