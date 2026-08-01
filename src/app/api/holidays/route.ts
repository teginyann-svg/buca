import { NextResponse } from "next/server";
import { fetchSwissClosingHolidays } from "@/lib/swiss-holidays";

export async function GET() {
  try {
    const holidays = await fetchSwissClosingHolidays();
    return NextResponse.json({
      holidays,
      dates: holidays.map((h) => h.date),
    });
  } catch (error) {
    console.error("[api/holidays]", error);
    const message =
      error instanceof Error ? error.message : "Erreur serveur inattendue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
