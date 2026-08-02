/**
 * Reconstruit data/clients.json (+ CSV) à partir :
 * 1) export API prod (si dispo)
 * 2) événements Google Calendar « Réservation — … »
 * Puis pousse le CSV vers l’API prod (Import).
 *
 * Usage : npm run clients:sync
 */
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

function loadEnvSync(filePath: string) {
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
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvSync(path.join(process.cwd(), "render.env"));
loadEnvSync(path.join(process.cwd(), ".env.local"));

const API_BASE = (
  process.env.VITE_API_BASE ||
  process.env.API_BASE ||
  "https://buca.onrender.com"
).replace(/\/$/, "");
const ADMIN = process.env.SALON_ADMIN_CODE?.trim() || "";
const DATA_DIR = path.join(process.cwd(), "data");

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Cliente", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

async function main() {
  const { clientsFromCsv, clientsToCsv } = await import(
    "../src/lib/clients-csv"
  );
  const { listWeekBookings } = await import("../src/lib/google-calendar");
  const { TIMEZONE } = await import("../src/lib/config");
  const { normalizeToSwissNational, phoneMatchKey } = await import(
    "../src/lib/swiss-phone"
  );
  type ClientRecord = import("../src/lib/client-types").ClientRecord;

  async function fetchProdClients(): Promise<ClientRecord[]> {
    if (!ADMIN) {
      console.warn("Pas de SALON_ADMIN_CODE — skip export prod.");
      return [];
    }
    const res = await fetch(`${API_BASE}/api/clients/export`, {
      headers: { "x-salon-code": ADMIN },
    });
    if (!res.ok) {
      console.warn("Export prod HTTP", res.status);
      return [];
    }
    return clientsFromCsv(await res.text());
  }

  async function listAllBookings() {
    const start = dayjs.tz("2025-01-01", TIMEZONE).startOf("day");
    const end = dayjs().tz(TIMEZONE).add(400, "day").endOf("day");
    const all: Awaited<ReturnType<typeof listWeekBookings>> = [];
    let cursor = start;
    while (cursor.isBefore(end)) {
      const next = cursor.add(1, "month");
      const chunk = await listWeekBookings(
        cursor.toISOString(),
        next.toISOString(),
      );
      all.push(...chunk);
      cursor = next;
    }
    return all;
  }

  function mergeByPhone(
    base: ClientRecord[],
    bookings: Awaited<ReturnType<typeof listAllBookings>>,
  ): ClientRecord[] {
    const byKey = new Map<string, ClientRecord>();
    for (const c of base) {
      const key = phoneMatchKey(c.phone);
      if (key) byKey.set(key, { ...c });
    }

    for (const b of bookings) {
      if (!b.clientPhone) continue;
      const phone =
        normalizeToSwissNational(b.clientPhone) || b.clientPhone.trim();
      const key = phoneMatchKey(phone);
      if (!key) continue;
      const visitDate = dayjs(b.start).tz(TIMEZONE).format("YYYY-MM-DD");
      const { firstName, lastName } = splitName(b.clientName);
      const existing = byKey.get(key);
      if (existing) {
        existing.firstVisitAt =
          existing.firstVisitAt && existing.firstVisitAt <= visitDate
            ? existing.firstVisitAt
            : visitDate;
        existing.lastVisitAt =
          existing.lastVisitAt && existing.lastVisitAt >= visitDate
            ? existing.lastVisitAt
            : visitDate;
        if (!existing.firstName) existing.firstName = firstName;
        if (!existing.lastName) existing.lastName = lastName;
        if (!existing.email && b.email) existing.email = b.email;
        existing.updatedAt = new Date().toISOString();
      } else {
        const stamp = new Date().toISOString();
        byKey.set(key, {
          id: randomUUID(),
          gender: null,
          lastName,
          firstName,
          birthDay: null,
          birthMonth: null,
          birthYear: null,
          address: "",
          phone,
          email: b.email ?? "",
          recettes: [""],
          firstVisitAt: visitDate,
          lastVisitAt: visitDate,
          isSuspect: Boolean(
            b.isNewClient ||
              b.nonSwissPhone ||
              b.generatedPhone ||
              b.disposableEmail,
          ),
          suspectReasons: [
            ...(b.isNewClient ? ["Nouvelle cliente"] : []),
            ...(b.nonSwissPhone ? ["N° non-suisse"] : []),
            ...(b.generatedPhone ? ["N° généré"] : []),
            ...(b.disposableEmail ? ["Email jetable"] : []),
          ],
          validatedAt: null,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
    }

    return [...byKey.values()].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
        "fr",
        { sensitivity: "base" },
      ),
    );
  }

  console.log("API:", API_BASE);
  const fromProd = await fetchProdClients();
  console.log(`Export prod: ${fromProd.length} fiche(s)`);

  console.log("Lecture Agenda Google…");
  const bookings = await listAllBookings();
  const withPhone = bookings.filter((b) => b.clientPhone);
  console.log(
    `RDV Agenda: ${bookings.length} (dont ${withPhone.length} avec téléphone)`,
  );

  const merged = mergeByPhone(fromProd, bookings);
  console.log(`Fusion: ${merged.length} fiche(s)`);
  for (const c of merged) {
    console.log(
      `- ${c.firstName} ${c.lastName} | ${c.phone} | 1re ${c.firstVisitAt} | dern ${c.lastVisitAt}`,
    );
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  const jsonPath = path.join(DATA_DIR, "clients.json");
  const csvPath = path.join(DATA_DIR, "clients.csv");
  const csv = clientsToCsv(merged);
  await fs.writeFile(jsonPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await fs.writeFile(csvPath, csv, "utf8");
  console.log("Écrit:", jsonPath, "et", csvPath);

  if (!ADMIN) {
    console.warn("Pas de SALON_ADMIN_CODE — skip import prod.");
    return;
  }

  // Import CSV (si déployé) sinon création une-par-une via POST /api/clients
  const res = await fetch(`${API_BASE}/api/clients/import`, {
    method: "POST",
    headers: {
      "x-salon-code": ADMIN,
      "Content-Type": "text/csv; charset=utf-8",
    },
    body: csv,
  });
  if (res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      imported?: number;
      error?: string;
    };
    console.log(`Prod: ${body.imported} fiche(s) importée(s) (CSV).`);
    console.log("OK.");
    return;
  }

  if (res.status !== 404 && res.status !== 405) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Import prod HTTP ${res.status}`);
  }

  console.warn(
    `Import CSV indisponible (HTTP ${res.status}) — fallback POST /api/clients…`,
  );
  const existingKeys = new Set(
    fromProd.map((c) => phoneMatchKey(c.phone)).filter(Boolean),
  );
  let created = 0;
  let skipped = 0;
  for (const c of merged) {
    const key = phoneMatchKey(c.phone);
    if (key && existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    const post = await fetch(`${API_BASE}/api/clients`, {
      method: "POST",
      headers: {
        "x-salon-code": ADMIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gender: c.gender,
        lastName: c.lastName,
        firstName: c.firstName,
        birthDay: c.birthDay,
        birthMonth: c.birthMonth,
        birthYear: c.birthYear,
        address: c.address,
        phone: c.phone,
        email: c.email,
        recettes: c.recettes,
        firstVisitAt: c.firstVisitAt,
        lastVisitAt: c.lastVisitAt,
      }),
    });
    if (!post.ok) {
      const err = (await post.json().catch(() => ({}))) as { error?: string };
      console.warn(
        `Échec ${c.firstName} ${c.phone}:`,
        err.error ?? post.status,
      );
      continue;
    }
    created += 1;
    if (key) existingKeys.add(key);
  }
  console.log(`Prod fallback: ${created} créée(s), ${skipped} déjà présente(s).`);
  console.log("OK.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
