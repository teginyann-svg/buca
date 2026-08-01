import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalonCode } from "@/lib/admin-auth";
import { createClient, readClients } from "@/lib/clients";

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

export async function GET(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const clients = await readClients();
    return NextResponse.json({ clients });
  } catch (error) {
    console.error("[api/clients GET]", error);
    return NextResponse.json(
      { error: "Impossible de charger les clients." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const json = await request.json();
    const parsed = clientBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données client invalides.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const firstName = parsed.data.firstName?.trim() ?? "";
    const phone = parsed.data.phone?.trim() ?? "";
    if (!firstName && !phone) {
      return NextResponse.json(
        { error: "Indiquez au moins un prénom ou un téléphone." },
        { status: 400 },
      );
    }

    const client = await createClient(parsed.data);
    return NextResponse.json({ ok: true, client });
  } catch (error) {
    console.error("[api/clients POST]", error);
    return NextResponse.json(
      { error: "Impossible de créer le client." },
      { status: 500 },
    );
  }
}
