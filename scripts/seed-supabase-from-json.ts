/**
 * Seed Supabase depuis data/*.json (bookings, clients, device-bookings, calculateur).
 *
 * Prérequis :
 *   1. Exécuter supabase/schema.sql dans le SQL Editor
 *   2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans .env.local
 *
 * Usage : npm run data:seed-supabase
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ClientRecord } from "../src/lib/client-types";
import type { StoredBooking } from "../src/lib/bookings";
import type { DeviceRecord } from "../src/lib/device-bookings";

function loadEnvSync(filePath: string, { override = false } = {}) {
  try {
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (override || process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvSync(path.join(process.cwd(), "render.env"));
loadEnvSync(path.join(process.cwd(), ".env.local"), { override: true });

function readJson<T>(rel: string, fallback: T): T {
  try {
    return JSON.parse(
      readFileSync(path.join(process.cwd(), rel), "utf8"),
    ) as T;
  } catch {
    return fallback;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeClient(row: Record<string, unknown>): ClientRecord | null {
  if (typeof row.id !== "string") return null;
  const recettes = Array.isArray(row.recettes)
    ? row.recettes.filter((r): r is string => typeof r === "string")
    : [""];
  return {
    id: row.id,
    gender: row.gender === "H" || row.gender === "F" ? row.gender : null,
    lastName: typeof row.lastName === "string" ? row.lastName : "",
    firstName: typeof row.firstName === "string" ? row.firstName : "",
    birthDay: typeof row.birthDay === "number" ? row.birthDay : null,
    birthMonth: typeof row.birthMonth === "number" ? row.birthMonth : null,
    birthYear: typeof row.birthYear === "number" ? row.birthYear : null,
    address: typeof row.address === "string" ? row.address : "",
    phone: typeof row.phone === "string" ? row.phone : "",
    email: typeof row.email === "string" ? row.email : "",
    recettes: recettes.length > 0 ? recettes : [""],
    firstVisitAt:
      typeof row.firstVisitAt === "string" ? row.firstVisitAt : null,
    lastVisitAt: typeof row.lastVisitAt === "string" ? row.lastVisitAt : null,
    isSuspect: Boolean(row.isSuspect),
    suspectReasons: Array.isArray(row.suspectReasons)
      ? row.suspectReasons.filter((r): r is string => typeof r === "string")
      : [],
    validatedAt: typeof row.validatedAt === "string" ? row.validatedAt : null,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : nowIso(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : nowIso(),
  };
}

async function main() {
  const { isSupabaseConfigured } = await import("../src/lib/supabase");
  if (!isSupabaseConfigured()) {
    console.error(
      "Renseignez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local",
    );
    process.exit(1);
  }

  const { replaceAllBookings } = await import("../src/lib/bookings");
  const { replaceAllClients } = await import("../src/lib/clients");
  const { replaceAllDeviceBookings } = await import(
    "../src/lib/device-bookings"
  );
  const { replaceAllEstimates, replaceAllHiddenIds } = await import(
    "../src/lib/calculateur-estimates"
  );

  const bookingsRaw = readJson<unknown[]>("data/bookings.json", []);
  const bookings = (
    Array.isArray(bookingsRaw) ? bookingsRaw : []
  ) as StoredBooking[];
  console.log(`bookings: ${await replaceAllBookings(bookings)}`);

  const clientsRaw = readJson<unknown[]>("data/clients.json", []);
  const clients = (Array.isArray(clientsRaw) ? clientsRaw : [])
    .map((row) =>
      row && typeof row === "object"
        ? normalizeClient(row as Record<string, unknown>)
        : null,
    )
    .filter((c): c is ClientRecord => c !== null);
  console.log(`clients: ${await replaceAllClients(clients)}`);

  const devices = readJson<Record<string, DeviceRecord>>(
    "data/device-bookings.json",
    {},
  );
  console.log(
    `device_bookings: ${await replaceAllDeviceBookings(
      devices && typeof devices === "object" ? devices : {},
    )}`,
  );

  const estimates = readJson<Record<string, number>>(
    "data/calculateur-estimates.json",
    {},
  );
  console.log(
    `calculateur_estimates: ${await replaceAllEstimates(
      estimates && typeof estimates === "object" ? estimates : {},
    )}`,
  );

  const hidden = readJson<string[]>("data/calculateur-hidden.json", []);
  console.log(
    `calculateur_hidden: ${await replaceAllHiddenIds(
      Array.isArray(hidden) ? hidden : [],
    )}`,
  );

  console.log("OK — seed Supabase terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
