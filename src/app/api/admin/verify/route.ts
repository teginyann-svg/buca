import { NextResponse } from "next/server";
import { requireSalonCode } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const authError = await requireSalonCode(request);
  if (authError) return authError;
  return NextResponse.json({ ok: true });
}
