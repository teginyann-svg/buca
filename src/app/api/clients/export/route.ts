import { NextResponse } from "next/server";
import { requireSalonCode } from "@/lib/admin-auth";
import { exportClientsCsv } from "@/lib/clients";

/** Téléchargement backup CSV du fichier clients (auth salon). */
export async function GET(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const csv = await exportClientsCsv();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clients-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/clients/export]", error);
    return NextResponse.json(
      { error: "Impossible d’exporter le CSV." },
      { status: 500 },
    );
  }
}
