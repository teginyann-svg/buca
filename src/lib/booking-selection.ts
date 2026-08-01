import { z } from "zod";
import type { CalculateurSelection } from "@/lib/calculateur";

export const selectionSchema = z.object({
  coupe: z.enum(["long", "court", "homme"]).nullable(),
  couleur: z.boolean(),
  balayage: z.boolean(),
  vegetale: z.union([z.literal(1), z.literal(2)]).nullable(),
  keratine: z.boolean(),
  sechage: z.boolean(),
  brushing: z.enum(["long", "court"]).nullable(),
});

export function parseSelection(raw: unknown): CalculateurSelection | null {
  const parsed = selectionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
