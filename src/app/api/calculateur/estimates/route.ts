import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSalonCode } from "@/lib/admin-auth";
import {
  hideCombination,
  readEstimates,
  readHiddenIds,
  saveEstimate,
} from "@/lib/calculateur-estimates";

export async function GET(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const [estimates, hidden] = await Promise.all([
      readEstimates(),
      readHiddenIds(),
    ]);
    return NextResponse.json({ estimates, hidden });
  } catch (error) {
    console.error("[api/calculateur/estimates GET]", error);
    return NextResponse.json(
      { error: "Impossible de charger les estimations." },
      { status: 500 },
    );
  }
}

const bodySchema = z.object({
  id: z.string().min(1).max(200),
  minutes: z.number().int().min(1).max(24 * 60),
});

export async function PUT(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides (minutes entre 1 et 1440)." },
        { status: 400 },
      );
    }

    const estimates = await saveEstimate(parsed.data.id, parsed.data.minutes);
    return NextResponse.json({ ok: true, estimates });
  } catch (error) {
    console.error("[api/calculateur/estimates PUT]", error);
    return NextResponse.json(
      { error: "Impossible d’enregistrer l’estimation." },
      { status: 500 },
    );
  }
}

const deleteSchema = z.object({
  id: z.string().min(1).max(200),
});

export async function DELETE(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;

  try {
    const json = await request.json();
    const parsed = deleteSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Identifiant de combinaison manquant." },
        { status: 400 },
      );
    }

    const hidden = await hideCombination(parsed.data.id);
    const estimates = await readEstimates();
    return NextResponse.json({ ok: true, hidden, estimates });
  } catch (error) {
    console.error("[api/calculateur/estimates DELETE]", error);
    return NextResponse.json(
      { error: "Impossible d’effacer la combinaison." },
      { status: 500 },
    );
  }
}
