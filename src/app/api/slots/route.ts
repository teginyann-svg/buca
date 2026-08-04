import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { NextResponse } from "next/server";
import { z } from "zod";
import { computeFreeSlots } from "@/lib/availability";
import { SLOT_DURATION_MINUTES, TIMEZONE } from "@/lib/config";
import { fetchBusyIntervals } from "@/lib/bookings";
import { isSwissHolidayDate } from "@/lib/swiss-holidays";

dayjs.extend(utc);
dayjs.extend(timezone);

const querySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  duration: z.coerce.number().int().min(5).max(12 * 60).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      date: searchParams.get("date"),
      duration: searchParams.get("duration") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètre date invalide (attendu YYYY-MM-DD)." },
        { status: 400 },
      );
    }

    const { date } = parsed.data;
    const duration = parsed.data.duration ?? SLOT_DURATION_MINUTES;
    const dayStart = dayjs.tz(date, TIMEZONE).startOf("day");
    if (!dayStart.isValid()) {
      return NextResponse.json({ error: "Date invalide." }, { status: 400 });
    }

    if (await isSwissHolidayDate(date)) {
      return NextResponse.json({
        date,
        duration,
        slots: [],
        holiday: true,
        error: "Jour férié — salon fermé.",
      });
    }

    const timeMin = dayStart.toISOString();
    const timeMax = dayStart.endOf("day").toISOString();
    const busy = await fetchBusyIntervals(timeMin, timeMax);
    const slots = computeFreeSlots(date, busy, dayjs(), duration);

    return NextResponse.json({ date, duration, slots });
  } catch (error) {
    console.error("[api/slots]", error);
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
