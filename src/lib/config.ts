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

/** Google Calendar ID (email or "primary"). */
export const CALENDAR_ID =
  process.env.GOOGLE_CALENDAR_ID ?? "redroomcoiffure@gmail.com";

/**
 * Agenda public Google « Jours fériés en Suisse »
 * (déjà abonné sur le compte salon).
 */
export const SWISS_HOLIDAYS_CALENDAR_ID =
  process.env.GOOGLE_HOLIDAYS_CALENDAR_ID ??
  "fr.ch#holiday@group.v.calendar.google.com";

export const SALON_NAME = "Réservez un RDV avec Danijela";

/** Lieu affiché dans Google Agenda. */
export const SALON_LOCATION = "Red Room Coiffure";

/**
 * Opening hours (Europe/Zurich).
 * Mer–ven 09:00–19:00 (dernier début 18:45), sam 09:00–17:00 (dernier début 16:45).
 */
export const OPENING_HOURS: OpeningHours = {
  wednesday: { start: "09:00", end: "19:00" },
  thursday: { start: "09:00", end: "19:00" },
  friday: { start: "09:00", end: "19:00" },
  saturday: { start: "09:00", end: "17:00" },
};

/** How many days ahead clients can book. */
export const BOOKING_HORIZON_DAYS = 60;

/** Minimum lead time before a slot can be booked (minutes). */
export const MIN_LEAD_MINUTES = 60;

/**
 * Dernier début de RDV possible = fermeture − ce délai.
 * Ex. samedi 17:00 → dernier créneau 16:45 ; mer–ven 19:00 → 18:45.
 * La prestation peut se terminer après l’heure de fermeture.
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
