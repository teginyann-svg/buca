import { NextResponse } from "next/server";
import { parseSelection } from "@/lib/booking-selection";
import { resolveDurationForSelection } from "@/lib/calculateur-estimates";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const selection = parseSelection(json?.selection ?? json);
    if (!selection) {
      return NextResponse.json(
        { error: "Sélection de services invalide." },
        { status: 400 },
      );
    }

    const quote = await resolveDurationForSelection(selection);
    if (!quote) {
      return NextResponse.json(
        { error: "Choisissez au moins un service." },
        { status: 400 },
      );
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error("[api/booking/quote]", error);
    return NextResponse.json(
      { error: "Impossible de calculer la durée." },
      { status: 500 },
    );
  }
}
