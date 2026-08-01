import { NextResponse } from "next/server";
import { z } from "zod";
import { findClientByPhone } from "@/lib/clients";
import { checkSwissPhone } from "@/lib/swiss-phone";

const bodySchema = z.object({
  phone: z.string().trim().min(6).max(40),
});

/**
 * Lookup public (étape 3 réservation) — retourne uniquement prénom / nom / email.
 * Pas d’auth salon : pas de recettes ni données sensibles.
 */
export async function POST(request: Request) {
  try {
    const json: unknown = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ found: false });
    }

    const check = checkSwissPhone(parsed.data.phone);
    if (!check.ok && check.digits.length < 8) {
      return NextResponse.json({ found: false });
    }

    const client = await findClientByPhone(parsed.data.phone);
    if (!client) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
      email: client.email ?? "",
    });
  } catch (error) {
    console.error("[api/clients/lookup]", error);
    return NextResponse.json({ found: false }, { status: 500 });
  }
}
