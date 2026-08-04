import { NextResponse } from "next/server";
import { requireSalonCode } from "@/lib/admin-auth";
import { deleteBookingEvent } from "@/lib/bookings";

type RouteContext = {
  params: Promise<{ eventId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const { eventId } = await context.params;
    if (!eventId?.trim()) {
      return NextResponse.json(
        { error: "Identifiant d’événement manquant." },
        { status: 400 },
      );
    }

    await deleteBookingEvent(decodeURIComponent(eventId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/week/delete]", error);
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
