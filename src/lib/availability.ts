import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
  BOOKING_HORIZON_DAYS,
  LAST_START_BEFORE_CLOSE_MINUTES,
  MIN_LEAD_MINUTES,
  OPENING_HOURS,
  SLOT_DURATION_MINUTES,
  TIMEZONE,
  WEEKDAY_BY_JS,
  type Weekday,
} from "./config";

dayjs.extend(utc);
dayjs.extend(timezone);

export type BusyInterval = {
  start: string;
  end: string;
};

export type TimeSlot = {
  start: string;
  end: string;
  label: string;
};

function parseHm(hm: string): { hour: number; minute: number } {
  const [hour, minute] = hm.split(":").map(Number);
  return { hour, minute };
}

function overlaps(
  aStart: Dayjs,
  aEnd: Dayjs,
  bStart: Dayjs,
  bEnd: Dayjs,
): boolean {
  return aStart.isBefore(bEnd) && aEnd.isAfter(bStart);
}

export function isBookableDate(
  date: Dayjs,
  now = dayjs(),
  holidayDates?: ReadonlySet<string>,
): boolean {
  const local = date.tz(TIMEZONE).startOf("day");
  const today = now.tz(TIMEZONE).startOf("day");
  const max = today.add(BOOKING_HORIZON_DAYS, "day");
  if (local.isBefore(today) || local.isAfter(max)) return false;
  if (holidayDates?.has(local.format("YYYY-MM-DD"))) return false;
  const weekday = WEEKDAY_BY_JS[local.day()] as Weekday;
  return Boolean(OPENING_HOURS[weekday]);
}

/**
 * Build free slots for a calendar day in Europe/Zurich,
 * excluding busy intervals from Google Calendar.
 * Dernier début = fermeture − durée des services + latitude
 * (ex. 19:00, 90 min, latitude 15 → dernier début 17:45, fin 19:15).
 */
export function computeFreeSlots(
  dateIso: string,
  busy: BusyInterval[],
  now = dayjs(),
  durationMinutes = SLOT_DURATION_MINUTES,
  stepMinutes = 15,
): TimeSlot[] {
  const duration = Math.max(5, Math.floor(durationMinutes));
  const step = Math.max(5, Math.floor(stepMinutes));

  const day = dayjs.tz(dateIso, TIMEZONE).startOf("day");
  if (!day.isValid()) return [];

  const weekday = WEEKDAY_BY_JS[day.day()] as Weekday;
  const hours = OPENING_HOURS[weekday];
  if (!hours) return [];

  const { hour: startH, minute: startM } = parseHm(hours.start);
  const { hour: endH, minute: endM } = parseHm(hours.end);

  let cursor = day.hour(startH).minute(startM).second(0).millisecond(0);
  const dayEnd = day.hour(endH).minute(endM).second(0).millisecond(0);
  // Fin du RDV autorisée jusqu’à fermeture + latitude (15 min).
  const lastStart = dayEnd
    .subtract(duration, "minute")
    .add(LAST_START_BEFORE_CLOSE_MINUTES, "minute");
  const earliest = now.tz(TIMEZONE).add(MIN_LEAD_MINUTES, "minute");

  const busyParsed = busy.map((b) => ({
    start: dayjs(b.start).tz(TIMEZONE),
    end: dayjs(b.end).tz(TIMEZONE),
  }));

  const slots: TimeSlot[] = [];

  while (!cursor.isAfter(lastStart)) {
    const slotEnd = cursor.add(duration, "minute");

    const startsSoonEnough = !cursor.isBefore(earliest);
    const conflicts = busyParsed.some((b) =>
      overlaps(cursor, slotEnd, b.start, b.end),
    );

    if (startsSoonEnough && !conflicts) {
      slots.push({
        start: cursor.toISOString(),
        end: slotEnd.toISOString(),
        label: cursor.format("HH:mm"),
      });
    }

    cursor = cursor.add(step, "minute");
  }

  return slots;
}
