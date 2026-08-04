import dayjs from "dayjs";
import "dayjs/locale/fr";
import isoWeek from "dayjs/plugin/isoWeek";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalonCode } from "@/lib/admin-auth";
import { TIMEZONE } from "@/lib/config";
import { listWeekBookings } from "@/lib/bookings";
import { getDeviceSeverityHint } from "@/lib/device-bookings";
import { fetchSwissClosingHolidaysInRange } from "@/lib/swiss-holidays";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isoWeek);
dayjs.locale("fr");

const querySchema = z.object({
  weekOffset: z.coerce.number().int().min(-12).max(12).default(0),
});

export async function GET(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      weekOffset: searchParams.get("weekOffset") ?? "0",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Paramètre weekOffset invalide." },
        { status: 400 },
      );
    }

    const { weekOffset } = parsed.data;
    const weekStart = dayjs()
      .tz(TIMEZONE)
      .add(weekOffset, "week")
      .startOf("isoWeek");
    const weekEnd = weekStart.endOf("isoWeek");
    const displayStart = weekStart.add(2, "day"); // mercredi
    const displayEnd = weekStart.add(5, "day"); // samedi

    const bookingsRaw = await listWeekBookings(
      weekStart.toISOString(),
      weekEnd.toISOString(),
    );

    const bookings = await Promise.all(
      bookingsRaw.map(async (booking) => {
        if (!booking.deviceId || booking.sameDevice) return booking;
        try {
          const visitDate = dayjs(booking.start).tz(TIMEZONE).format("YYYY-MM-DD");
          const hint = await getDeviceSeverityHint(booking.deviceId, visitDate);
          if (hint === "same_device") {
            return { ...booking, sameDevice: true };
          }
          return booking;
        } catch {
          return booking;
        }
      }),
    );

    const holidays = await fetchSwissClosingHolidaysInRange(
      displayStart.startOf("day").toISOString(),
      displayEnd.endOf("day").toISOString(),
    );

    return NextResponse.json({
      weekOffset,
      weekStart: weekStart.format("YYYY-MM-DD"),
      weekEnd: weekEnd.format("YYYY-MM-DD"),
      label: `${displayStart.format("D MMM")} – ${displayEnd.format("D MMM YYYY")}`,
      bookings,
      holidays,
    });
  } catch (error) {
    console.error("[api/week]", error);
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
