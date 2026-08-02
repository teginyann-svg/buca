import { NextResponse } from "next/server";
import { requireSalonCode } from "@/lib/admin-auth";
import { importClientsFromCsv } from "@/lib/clients";

/** Restauration backup CSV du fichier clients (auth salon) — remplace tout. */
export async function POST(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let csv = "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { csv?: unknown };
      csv = typeof body.csv === "string" ? body.csv : "";
    } else {
      csv = await request.text();
    }
    if (!csv.trim()) {
      return NextResponse.json(
        { error: "Fichier CSV vide." },
        { status: 400 },
      );
    }
    const imported = await importClientsFromCsv(csv);
    return NextResponse.json({ ok: true, imported });
  } catch (error) {
    console.error("[api/clients/import]", error);
    const msg =
      error instanceof Error ? error.message : "Impossible d’importer le CSV.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
