import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ClientInput, ClientRecord } from "./client-types";
import { clientsToCsv } from "./clients-csv";
import { getDataDir } from "./data-dir";
import { isDisposableEmail } from "./disposable-emails";
import { checkSwissPhone, phoneMatchKey } from "./swiss-phone";

export type { ClientGender, ClientInput, ClientRecord } from "./client-types";
export { formatBirthDate } from "./client-types";
export { clientsToCsv, clientsFromCsv } from "./clients-csv";

function dataPaths() {
  const DATA_DIR = getDataDir();
  return {
    DATA_DIR,
    FILE_PATH: path.join(DATA_DIR, "clients.json"),
    CSV_PATH: path.join(DATA_DIR, "clients.csv"),
    BUNDLED_JSON: path.join(process.cwd(), "data", "clients.json"),
  };
}

async function ensureFile(): Promise<void> {
  const { DATA_DIR, FILE_PATH, BUNDLED_JSON } = dataPaths();
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    try {
      await fs.copyFile(BUNDLED_JSON, FILE_PATH);
    } catch {
      await fs.writeFile(FILE_PATH, "[]\n", "utf8");
    }
  }
}

async function writeClientsCsvBackup(clients: ClientRecord[]): Promise<void> {
  const { DATA_DIR, CSV_PATH } = dataPaths();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CSV_PATH, clientsToCsv(clients), "utf8");
}

function clampDay(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 1 || n > 31) return null;
  return n;
}

function clampMonth(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  if (n < 1 || n > 12) return null;
  return n;
}

function clampYear(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.floor(value);
  const maxYear = new Date().getFullYear();
  if (n < 1900 || n > maxYear) return null;
  return n;
}

function sanitizeRecettes(recettes: unknown): string[] {
  if (!Array.isArray(recettes)) return [""];
  const cleaned = recettes
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.trimEnd());
  return cleaned.length > 0 ? cleaned : [""];
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeClientRow(row: Record<string, unknown>): ClientRecord | null {
  if (typeof row.id !== "string") return null;
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
    recettes: sanitizeRecettes(row.recettes),
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

function phoneSuspectReasons(phone: string): string[] {
  if (!phone.trim()) return [];
  const check = checkSwissPhone(phone);
  const reasons: string[] = [];
  if (check.looksGenerated) {
    reasons.push("N° généré");
  } else if (!check.isSwiss) {
    reasons.push("N° non-suisse");
  }
  if (!check.ok && reasons.length === 0) {
    reasons.push(...check.errors);
  }
  return reasons;
}

function emailSuspectReasons(email: string): string[] {
  if (!email.trim()) return [];
  if (isDisposableEmail(email)) return ["Email jetable"];
  return [];
}

export async function readClients(): Promise<ClientRecord[]> {
  await ensureFile();
  const { FILE_PATH } = dataPaths();
  const raw = await fs.readFile(FILE_PATH, "utf8");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) =>
        row && typeof row === "object"
          ? normalizeClientRow(row as Record<string, unknown>)
          : null,
      )
      .filter((row): row is ClientRecord => row !== null);
  } catch {
    return [];
  }
}

async function writeClients(clients: ClientRecord[]): Promise<void> {
  await ensureFile();
  const { FILE_PATH } = dataPaths();
  await fs.writeFile(
    FILE_PATH,
    `${JSON.stringify(clients, null, 2)}\n`,
    "utf8",
  );
  try {
    await writeClientsCsvBackup(clients);
  } catch (error) {
    console.error("[clients] CSV backup", error);
  }
}

/** Contenu CSV à jour (pour téléchargement / copie). */
export async function exportClientsCsv(): Promise<string> {
  const clients = await readClients();
  return clientsToCsv(clients);
}

export async function getClientById(id: string): Promise<ClientRecord | null> {
  const clients = await readClients();
  return clients.find((c) => c.id === id) ?? null;
}

export async function findClientByPhone(
  phone: string,
): Promise<ClientRecord | null> {
  const needle = phoneMatchKey(phone);
  if (!needle) return null;
  const clients = await readClients();
  return (
    clients.find((c) => phoneMatchKey(c.phone) === needle) ?? null
  );
}

export async function createClient(input: ClientInput): Promise<ClientRecord> {
  const clients = await readClients();
  const stamp = nowIso();
  const phone = (input.phone ?? "").trim();
  const phoneReasons = phoneSuspectReasons(phone);
  const emailReasons = emailSuspectReasons((input.email ?? "").trim());
  const explicitSuspect = input.isSuspect === true;
  const reasons = [
    ...(input.suspectReasons ?? []),
    ...phoneReasons,
    ...emailReasons,
  ].filter((r, i, arr) => arr.indexOf(r) === i);

  const client: ClientRecord = {
    id: randomUUID(),
    gender: input.gender === "H" || input.gender === "F" ? input.gender : null,
    lastName: (input.lastName ?? "").trim(),
    firstName: (input.firstName ?? "").trim(),
    birthDay: clampDay(input.birthDay),
    birthMonth: clampMonth(input.birthMonth),
    birthYear: clampYear(input.birthYear),
    address: (input.address ?? "").trim(),
    phone,
    email: (input.email ?? "").trim(),
    recettes: sanitizeRecettes(input.recettes),
    firstVisitAt: input.firstVisitAt ?? null,
    lastVisitAt: input.lastVisitAt ?? null,
    isSuspect: input.validatedAt
      ? false
      : explicitSuspect || reasons.length > 0,
    suspectReasons: input.validatedAt ? [] : reasons,
    validatedAt: input.validatedAt ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  };
  clients.push(client);
  clients.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(
      `${b.lastName} ${b.firstName}`,
      "fr",
      { sensitivity: "base" },
    ),
  );
  await writeClients(clients);
  return client;
}

export async function updateClient(
  id: string,
  input: ClientInput,
): Promise<ClientRecord | null> {
  const clients = await readClients();
  const index = clients.findIndex((c) => c.id === id);
  if (index < 0) return null;

  const prev = clients[index];
  const nextPhone =
    input.phone === undefined ? prev.phone : input.phone.trim();
  const nextEmail =
    input.email === undefined ? prev.email : input.email.trim();
  const phoneReasons =
    input.phone === undefined ? [] : phoneSuspectReasons(nextPhone);
  const emailReasons =
    input.email === undefined ? [] : emailSuspectReasons(nextEmail);
  const mergedReasons = [
    ...(input.suspectReasons !== undefined
      ? input.suspectReasons
      : prev.suspectReasons),
    ...phoneReasons,
    ...emailReasons,
  ].filter((r, i, arr) => arr.indexOf(r) === i);

  const clearingSuspect =
    input.isSuspect === false || input.validatedAt !== undefined;

  const next: ClientRecord = {
    ...prev,
    gender:
      input.gender === undefined
        ? prev.gender
        : input.gender === "H" || input.gender === "F"
          ? input.gender
          : null,
    lastName:
      input.lastName === undefined ? prev.lastName : input.lastName.trim(),
    firstName:
      input.firstName === undefined ? prev.firstName : input.firstName.trim(),
    birthDay:
      input.birthDay === undefined ? prev.birthDay : clampDay(input.birthDay),
    birthMonth:
      input.birthMonth === undefined
        ? prev.birthMonth
        : clampMonth(input.birthMonth),
    birthYear:
      input.birthYear === undefined
        ? prev.birthYear
        : clampYear(input.birthYear),
    address: input.address === undefined ? prev.address : input.address.trim(),
    phone: nextPhone,
    email: input.email === undefined ? prev.email : input.email.trim(),
    recettes:
      input.recettes === undefined
        ? prev.recettes
        : sanitizeRecettes(input.recettes),
    firstVisitAt:
      input.firstVisitAt === undefined ? prev.firstVisitAt : input.firstVisitAt,
    lastVisitAt:
      input.lastVisitAt === undefined ? prev.lastVisitAt : input.lastVisitAt,
    isSuspect: clearingSuspect
      ? Boolean(input.isSuspect)
      : input.isSuspect === true ||
        prev.isSuspect ||
        phoneReasons.length > 0,
    suspectReasons: clearingSuspect
      ? (input.suspectReasons ?? [])
      : mergedReasons,
    validatedAt:
      input.validatedAt === undefined ? prev.validatedAt : input.validatedAt,
    updatedAt: nowIso(),
  };

  clients[index] = next;
  clients.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(
      `${b.lastName} ${b.firstName}`,
      "fr",
      { sensitivity: "base" },
    ),
  );
  await writeClients(clients);
  return next;
}

export async function deleteClient(id: string): Promise<boolean> {
  const clients = await readClients();
  const next = clients.filter((c) => c.id !== id);
  if (next.length === clients.length) return false;
  await writeClients(next);
  return true;
}

/** Valide manuellement un client suspect (retire le signalement). */
export async function validateClient(
  id: string,
): Promise<ClientRecord | null> {
  return updateClient(id, {
    isSuspect: false,
    suspectReasons: [],
    validatedAt: nowIso(),
  });
}

/**
 * Met à jour (ou crée) la fiche client après une réservation.
 * Correspondance par numéro de téléphone.
 */
export async function recordVisitFromBooking(input: {
  phone: string;
  firstName: string;
  lastName?: string;
  visitDate: string;
  email?: string;
  isSuspect?: boolean;
  suspectReasons?: string[];
}): Promise<ClientRecord> {
  const visitDate = input.visitDate;
  const existing = await findClientByPhone(input.phone);
  const extraReasons = input.suspectReasons ?? [];

  if (existing) {
    const firstVisitAt =
      existing.firstVisitAt && existing.firstVisitAt <= visitDate
        ? existing.firstVisitAt
        : visitDate;
    const lastVisitAt =
      existing.lastVisitAt && existing.lastVisitAt >= visitDate
        ? existing.lastVisitAt
        : visitDate;

    const shouldFlag =
      !existing.validatedAt &&
      (input.isSuspect || extraReasons.length > 0 || existing.isSuspect);

    const patched = await updateClient(existing.id, {
      firstVisitAt,
      lastVisitAt,
      firstName: existing.firstName || input.firstName,
      lastName: existing.lastName || (input.lastName ?? ""),
      email: existing.email || input.email || existing.email,
      isSuspect: shouldFlag ? true : undefined,
      suspectReasons: shouldFlag
        ? [...existing.suspectReasons, ...extraReasons].filter(
            (r, i, arr) => arr.indexOf(r) === i,
          )
        : undefined,
    });
    return patched ?? existing;
  }

  return createClient({
    firstName: input.firstName.trim(),
    lastName: (input.lastName ?? "").trim(),
    phone: input.phone.trim(),
    email: (input.email ?? "").trim(),
    firstVisitAt: visitDate,
    lastVisitAt: visitDate,
    recettes: [""],
    isSuspect: Boolean(input.isSuspect) || extraReasons.length > 0,
    suspectReasons: extraReasons,
  });
}
