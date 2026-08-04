import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { BOOKING_HORIZON_DAYS, TIMEZONE } from "./config";

dayjs.extend(utc);
dayjs.extend(timezone);

export type SwissHoliday = {
  date: string;
  summary: string;
};

type NagerHoliday = {
  date: string;
  localName?: string;
  name?: string;
  counties?: string[] | null;
  types?: string[];
};

/** Jours fériés CH nationaux + canton Zurich (salon). */
function appliesToZurich(h: NagerHoliday): boolean {
  if (!h.counties || h.counties.length === 0) return true;
  return h.counties.some(
    (c) => c === "CH-ZH" || c.endsWith("-ZH") || c.includes("ZH"),
  );
}

function isPublicHolidayType(h: NagerHoliday): boolean {
  if (!h.types || h.types.length === 0) return true;
  return h.types.some((t) => /public/i.test(t));
}

let cache: { expiresAt: number; holidays: SwissHoliday[] } | null = null;
const CACHE_MS = 12 * 60 * 60 * 1000;
const rangeCache = new Map<
  string,
  { expiresAt: number; holidays: SwissHoliday[] }
>();

async function fetchNagerYear(year: number): Promise<SwissHoliday[]> {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/CH`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Jours fériés CH indisponibles (${res.status}).`);
  }
  const data = (await res.json()) as NagerHoliday[];
  const out: SwissHoliday[] = [];
  const seen = new Set<string>();
  for (const h of data) {
    if (!appliesToZurich(h) || !isPublicHolidayType(h)) continue;
    if (!h.date || seen.has(h.date)) continue;
    seen.add(h.date);
    out.push({
      date: h.date,
      summary: (h.localName || h.name || "Jour férié").trim(),
    });
  }
  return out;
}

async function listClosingHolidaysBetween(
  timeMin: string,
  timeMax: string,
): Promise<SwissHoliday[]> {
  const start = dayjs(timeMin).tz(TIMEZONE);
  const end = dayjs(timeMax).tz(TIMEZONE);
  const years = new Set<number>();
  years.add(start.year());
  years.add(end.year());
  const all: SwissHoliday[] = [];
  for (const year of years) {
    all.push(...(await fetchNagerYear(year)));
  }
  return all.filter((h) => {
    const d = dayjs.tz(h.date, TIMEZONE);
    return (
      (d.isAfter(start, "day") || d.isSame(start, "day")) &&
      (d.isBefore(end, "day") || d.isSame(end, "day"))
    );
  });
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

/** Conservé pour compat tests / anciens appels (Nager n’a pas ces libellés). */
export function isSwissClosingHoliday(event: {
  summary?: string | null;
  description?: string | null;
}): boolean {
  const summary = event.summary ?? "";
  const description = event.description ?? "";
  const firstLine = description.split("\n")[0]?.trim() ?? "";
  if (/heure d['’]/i.test(summary)) return false;
  if (/journée d['’]observance/i.test(firstLine)) return false;
  if (/^Observance\b/i.test(firstLine)) return false;
  return true;
}
