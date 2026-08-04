import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { NextResponse } from "next/server";
import { z } from "zod";
import { computeFreeSlots } from "@/lib/availability";
import { selectionSchema } from "@/lib/booking-selection";
import { resolveDurationForSelection } from "@/lib/calculateur-estimates";
import { findClientByPhone, recordVisitFromBooking } from "@/lib/clients";
import { TIMEZONE } from "@/lib/config";
import {
  evaluateDeviceBookingLimit,
  recordDeviceBooking,
} from "@/lib/device-bookings";
import { isDisposableEmail } from "@/lib/disposable-emails";
import {
  createBookingEvent,
  fetchBusyIntervals,
} from "@/lib/bookings";
import { assertValidSwissPhone, checkSwissPhone } from "@/lib/swiss-phone";
import { isSwissHolidayDate } from "@/lib/swiss-holidays";

dayjs.extend(utc);
dayjs.extend(timezone);

const bodySchema = z.object({
  start: z.string().datetime({ offset: true }),
  clientFirstName: z.string().trim().min(1).max(60),
  clientLastName: z.string().trim().max(60).optional().default(""),
  clientPhone: z.string().trim().min(6).max(30),
  clientEmail: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v ?? "")
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Email invalide",
    }),
  deviceId: z.string().trim().min(8).max(80).optional(),
  /** Confirmation client après plafond jour/semaine (pas la fenêtre courte). */
  confirmDeviceCeiling: z.boolean().optional().default(false),
  selection: selectionSchema,
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Données de réservation invalides.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      start,
      clientFirstName,
      clientLastName,
      clientPhone,
      clientEmail,
      deviceId,
      confirmDeviceCeiling,
      selection,
    } = parsed.data;

    const email = clientEmail?.trim() || "";
    const disposableEmail = Boolean(email && isDisposableEmail(email));

    const phoneError = assertValidSwissPhone(clientPhone);
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 });
    }
    const phoneCheck = checkSwissPhone(clientPhone);

    const quote = await resolveDurationForSelection(selection);
    if (!quote) {
      return NextResponse.json(
        { error: "Choisissez au moins un service." },
        { status: 400 },
      );
    }

    const startAt = dayjs(start).tz(TIMEZONE);
    if (!startAt.isValid()) {
      return NextResponse.json({ error: "Créneau invalide." }, { status: 400 });
    }

    const date = startAt.format("YYYY-MM-DD");
    if (await isSwissHolidayDate(date)) {
      return NextResponse.json(
        { error: "Jour férié — réservation impossible." },
        { status: 400 },
      );
    }

    const endAt = startAt.add(quote.minutes, "minute");

    const existingClient = await findClientByPhone(clientPhone);
    const isNewClient = !existingClient;

    // Confirmation appareil AVANT toute vérif de créneau / écriture Agenda :
    // si la cliente annule, aucun RDV n’est créé et le créneau reste libre.
    // Cliente connue (fichier) : plusieurs RDV OK sans modale (même appareil normal).
    let sameDevice = false;
    if (deviceId) {
      const limit = await evaluateDeviceBookingLimit({
        deviceId,
        visitDate: date,
        confirmedCeiling: confirmDeviceCeiling,
        knownClient: !isNewClient,
      });
      if (!limit.allowed && limit.needsConfirmation) {
        return NextResponse.json(
          {
            error:
              limit.message ??
              "Êtes-vous sûr(e) de vouloir continuer ?",
            needsConfirmation: true,
            code:
              limit.reason === "week"
                ? "DEVICE_WEEK_CONFIRM"
                : "DEVICE_DAY_CONFIRM",
          },
          { status: 409 },
        );
      }
      sameDevice = limit.severity === "same_device";
    }

    const dayStart = startAt.startOf("day");
    const busy = await fetchBusyIntervals(
      dayStart.toISOString(),
      dayStart.endOf("day").toISOString(),
    );
    const freeSlots = computeFreeSlots(date, busy, dayjs(), quote.minutes);
    const stillFree = freeSlots.some((s) => dayjs(s.start).isSame(startAt));

    if (!stillFree) {
      return NextResponse.json(
        {
          error:
            "Ce créneau n’est plus disponible. Veuillez en choisir un autre.",
        },
        { status: 409 },
      );
    }

    const nonSwissPhone = !phoneCheck.isSwiss;
    const generatedPhone = phoneCheck.looksGenerated;
    const clientName = [clientFirstName, clientLastName]
      .map((p) => p.trim())
      .filter(Boolean)
      .join(" ");

    const event = await createBookingEvent({
      start: startAt.toISOString(),
      end: endAt.toISOString(),
      clientName,
      clientPhone,
      email: email || null,
      deviceId: deviceId ?? null,
      servicesLabel: quote.label,
      durationMinutes: quote.minutes,
      isNewClient,
      sameDevice,
      nonSwissPhone,
      generatedPhone,
      disposableEmail,
    });

    if (deviceId) {
      try {
        await recordDeviceBooking({
          deviceId,
          phone: clientPhone,
          visitDate: date,
          eventId: event.id ?? null,
        });
      } catch (deviceError) {
        console.error("[api/book] device file", deviceError);
      }
    }

    const clientSuspectReasons = [
      ...(nonSwissPhone ? ["N° non-suisse"] : []),
      ...(generatedPhone ? ["N° généré"] : []),
      ...(disposableEmail ? ["Email jetable"] : []),
    ];

    const bookingGender =
      selection.coupe === "homme"
        ? ("H" as const)
        : selection.coupe === "long" || selection.coupe === "court"
          ? ("F" as const)
          : null;

    let clientRecorded = false;
    let clientRecordError: string | null = null;
    try {
      await recordVisitFromBooking({
        phone: phoneCheck.digits || clientPhone,
        firstName: clientFirstName,
        lastName: clientLastName,
        visitDate: date,
        email: email || undefined,
        gender: bookingGender,
        isSuspect: clientSuspectReasons.length > 0,
        suspectReasons: clientSuspectReasons,
      });
      clientRecorded = true;
    } catch (clientError) {
      clientRecordError =
        clientError instanceof Error
          ? clientError.message
          : "Écriture fichier clients impossible.";
      console.error("[api/book] clients file", clientError);
    }

    return NextResponse.json({
      ok: true,
      eventId: event.id,
      htmlLink: event.htmlLink,
      start: startAt.toISOString(),
      end: endAt.toISOString(),
      firstName: clientFirstName,
      servicesLabel: quote.label,
      durationMinutes: quote.minutes,
      isNewClient,
      sameDevice,
      nonSwissPhone,
      generatedPhone,
      disposableEmail,
      clientRecorded,
      clientRecordError,
    });
  } catch (error) {
    console.error("[api/book]", error);
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
