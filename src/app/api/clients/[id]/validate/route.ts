import { NextResponse } from "next/server";
import { requireSalonCode } from "@/lib/admin-auth";
import { validateClient } from "@/lib/clients";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const client = await validateClient(id);
    if (!client) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, client });
  } catch (error) {
    console.error("[api/clients/:id/validate]", error);
    return NextResponse.json(
      { error: "Impossible de valider le client." },
      { status: 500 },
    );
  }
}
