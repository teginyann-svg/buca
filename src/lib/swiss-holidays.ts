import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
  BOOKING_HORIZON_DAYS,
  SWISS_HOLIDAYS_CALENDAR_ID,
  TIMEZONE,
} from "./config";
import { getCalendarClient } from "./google-calendar";

dayjs.extend(utc);
dayjs.extend(timezone);

export type SwissHoliday = {
  date: string;
  summary: string;
};

/** True for closing public holidays; false for observances / DST / memorial days. */
export function isSwissClosingHoliday(event: {
  summary?: string | null;
  description?: string | null;
}): boolean {
  const summary = event.summary ?? "";
  const description = event.description ?? "";
  const firstLine = description.split("\n")[0]?.trim() ?? "";

  if (/heure d['’]/i.test(summary)) return false;
  if (/daylight saving|ende der sommerzeit|ende der winterzeit/i.test(summary)) {
    return false;
  }
  if (/journée d['’]observance/i.test(firstLine)) return false;
  if (/^Observance\b/i.test(firstLine)) return false;
  if (/^Gedenktag\b/i.test(firstLine)) return false;

  // National public holiday
  if (/^Jour férié$/i.test(firstLine)) return true;
  if (/^Public holiday$/i.test(firstLine)) return true;
  if (/^Gesetzlicher Feiertag$/i.test(firstLine)) return true;

  // Regional public holiday that applies to Zurich
  if (
    /jour férié|public holiday|(gesetzlicher )?feiertag/i.test(firstLine) &&
    /zurich|zürich/i.test(description)
  ) {
    return true;
  }

  return false;
}

let cache: { expiresAt: number; holidays: SwissHoliday[] } | null = null;
const CACHE_MS = 12 * 60 * 60 * 1000;
const rangeCache = new Map<string, { expiresAt: number; holidays: SwissHoliday[] }>();

async function listClosingHolidaysBetween(
  timeMin: string,
  timeMax: string,
): Promise<SwissHoliday[]> {
  const calendar = getCalendarClient();
  const response = await calendar.events.list({
    calendarId: SWISS_HOLIDAYS_CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const holidays: SwissHoliday[] = [];
  const seen = new Set<string>();

  for (const event of response.data.items ?? []) {
    if (!isSwissClosingHoliday(event)) continue;
    const date =
      event.start?.date ??
      (event.start?.dateTime
        ? dayjs(event.start.dateTime).tz(TIMEZONE).format("YYYY-MM-DD")
        : null);
    if (!date || seen.has(date)) continue;
    seen.add(date);
    holidays.push({
      date,
      summary: event.summary?.trim() || "Jour férié",
    });
  }

  return holidays;
}

export async function fetchSwissClosingHolidays(
  now = dayjs(),
): Promise<SwissHoliday[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.holidays;
  }

  const start = now.tz(TIMEZONE).startOf("day");
  const end = start.add(BOOKING_HORIZON_DAYS + 7, "day").endOf("day");
  const holidays = await listClosingHolidaysBetween(
    start.toISOString(),
    end.toISOString(),
  );

  cache = { expiresAt: Date.now() + CACHE_MS, holidays };
  return holidays;
}

/** Jours fériés fermeture sur une plage (ex. semaine Mes RDVs). */
export async function fetchSwissClosingHolidaysInRange(
  timeMin: string,
  timeMax: string,
): Promise<SwissHoliday[]> {
  const key = `${timeMin}|${timeMax}`;
  const hit = rangeCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.holidays;

  const holidays = await listClosingHolidaysBetween(timeMin, timeMax);
  rangeCache.set(key, { expiresAt: Date.now() + CACHE_MS, holidays });
  return holidays;
}

export async function getSwissHolidayDateSet(
  now = dayjs(),
): Promise<Set<string>> {
  const holidays = await fetchSwissClosingHolidays(now);
  return new Set(holidays.map((h) => h.date));
}

export async function isSwissHolidayDate(
  dateIso: string,
  now = dayjs(),
): Promise<boolean> {
  const set = await getSwissHolidayDateSet(now);
  return set.has(dateIso);
}
