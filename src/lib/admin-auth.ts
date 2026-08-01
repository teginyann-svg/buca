import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ADMIN_HEADER } from "./admin-constants";

function normalizeCode(value: string): string {
  return value.normalize("NFC").trim();
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function getExpectedSalonCode(): string | null {
  const raw = process.env.SALON_ADMIN_CODE;
  if (raw == null) return null;
  const expected = normalizeCode(raw);
  return expected.length > 0 ? expected : null;
}

/** Lit le code depuis header dédié, Authorization Bearer, ou body JSON `{ code }`. */
export async function readProvidedSalonCode(request: Request): Promise<string> {
  const header = normalizeCode(request.headers.get(ADMIN_HEADER) ?? "");
  if (header) return header;

  const auth = request.headers.get("authorization") ?? "";
  if (/^bearer\s+/i.test(auth)) {
    const token = normalizeCode(auth.replace(/^bearer\s+/i, ""));
    if (token) return token;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    try {
      const clone = request.clone();
      const json = (await clone.json()) as { code?: unknown };
      if (typeof json?.code === "string") {
        return normalizeCode(json.code);
      }
    } catch {
      // pas de JSON / body déjà consommé
    }
  }

  return "";
}

/** Returns an error response if the salon code is missing/invalid. */
export async function requireSalonCode(
  request: Request,
): Promise<NextResponse | null> {
  const expected = getExpectedSalonCode();
  if (!expected) {
    return NextResponse.json(
      {
        error:
          "SALON_ADMIN_CODE n’est pas configuré côté serveur. Ajoutez-le dans .env.local.",
      },
      { status: 503 },
    );
  }

  const provided = await readProvidedSalonCode(request);
  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json(
      { error: "Code salon invalide." },
      { status: 401 },
    );
  }

  return null;
}

export { ADMIN_HEADER };
