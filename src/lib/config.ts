export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type OpeningHours = Partial<
  Record<Weekday, { start: string; end: string }>
>;

/** Slot duration in minutes — fixed 1h30 sessions. */
export const SLOT_DURATION_MINUTES = 90;

export const TIMEZONE = "Europe/Zurich";

/** Safe on Vite client (no `process`) and Next server. */
function serverEnv(key: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env?.[key];
}

/** Google Calendar ID — uniquement pour scripts de migration. */
export const CALENDAR_ID =
  serverEnv("GOOGLE_CALENDAR_ID") ?? "redroomcoiffure@gmail.com";

export const SALON_NAME = "Réservez un RDV avec Danijela";

/** Lieu affiché (historique / libellés). */
export const SALON_LOCATION = "Red Room Coiffure";

/**
 * Opening hours (Europe/Zurich).
 * Mer–ven 09:00–19:00, sam 09:00–17:00.
 * Dernier début = fermeture − durée services + latitude 15 min.
 */
export const OPENING_HOURS: OpeningHours = {
  wednesday: { start: "09:00", end: "19:00" },
  thursday: { start: "09:00", end: "19:00" },
  friday: { start: "09:00", end: "19:00" },
  saturday: { start: "09:00", end: "17:00" },
};

/** How many days ahead clients can book. */
export const BOOKING_HORIZON_DAYS = 365;

/** Minimum lead time before a slot can be booked (minutes). */
export const MIN_LEAD_MINUTES = 60;

/**
 * Latitude après l’heure de fermeture (minutes).
 * Dernier début = fermeture − durée services + cette latitude.
 * Ex. mer–ven 19:00, 90 min → dernier début 17:45 (fin 19:15).
 */
export const LAST_START_BEFORE_CLOSE_MINUTES = 15;

export const WEEKDAY_BY_JS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
