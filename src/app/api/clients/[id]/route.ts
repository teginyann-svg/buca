import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalonCode } from "@/lib/admin-auth";
import {
  deleteClient,
  getClientById,
  updateClient,
} from "@/lib/clients";

const clientBodySchema = z.object({
  gender: z.enum(["H", "F"]).nullable().optional(),
  lastName: z.string().max(80).optional(),
  firstName: z.string().max(80).optional(),
  birthDay: z.number().int().min(1).max(31).nullable().optional(),
  birthMonth: z.number().int().min(1).max(12).nullable().optional(),
  birthYear: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .nullable()
    .optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().max(120).optional(),
  recettes: z.array(z.string().max(5000)).max(30).optional(),
  firstVisitAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  lastVisitAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const client = await getClientById(id);
    if (!client) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }
    return NextResponse.json({ client });
  } catch (error) {
    console.error("[api/clients/:id GET]", error);
    return NextResponse.json(
      { error: "Impossible de charger le client." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const json = await request.json();
    const parsed = clientBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données client invalides.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const client = await updateClient(id, parsed.data);
    if (!client) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, client });
  } catch (error) {
    console.error("[api/clients/:id PUT]", error);
    return NextResponse.json(
      { error: "Impossible d’enregistrer le client." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const { id } = await context.params;
    const ok = await deleteClient(id);
    if (!ok) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/clients/:id DELETE]", error);
    return NextResponse.json(
      { error: "Impossible de supprimer le client." },
      { status: 500 },
    );
  }
}
