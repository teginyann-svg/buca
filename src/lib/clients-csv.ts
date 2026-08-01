import type { ClientRecord } from "./client-types";

const CSV_HEADERS = [
  "id",
  "gender",
  "lastName",
  "firstName",
  "birthDay",
  "birthMonth",
  "birthYear",
  "address",
  "phone",
  "email",
  "recettes",
  "firstVisitAt",
  "lastVisitAt",
  "isSuspect",
  "suspectReasons",
  "validatedAt",
  "createdAt",
  "updatedAt",
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "1" : "0";
  return csvEscape(String(value));
}

/** Sépare les blocs recettes dans une cellule CSV. */
const RECETTE_SEP = "\n---\n";
const REASON_SEP = " | ";

export function clientsToCsv(clients: ClientRecord[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const c of clients) {
    const row = [
      cell(c.id),
      cell(c.gender),
      cell(c.lastName),
      cell(c.firstName),
      cell(c.birthDay),
      cell(c.birthMonth),
      cell(c.birthYear),
      cell(c.address),
      cell(c.phone),
      cell(c.email),
      cell(c.recettes.filter(Boolean).join(RECETTE_SEP)),
      cell(c.firstVisitAt),
      cell(c.lastVisitAt),
      cell(c.isSuspect),
      cell(c.suspectReasons.join(REASON_SEP)),
      cell(c.validatedAt),
      cell(c.createdAt),
      cell(c.updatedAt),
    ];
    lines.push(row.join(","));
  }
  return `${lines.join("\n")}\n`;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      if (current.trim()) rows.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) rows.push(current);
  return rows;
}

function parseNullableInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

/** Restaure des fiches depuis un CSV (backup). */
export function clientsFromCsv(text: string): ClientRecord[] {
  const rows = splitCsvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const header = parseCsvLine(rows[0]).map((h) => h.trim());
  const index = Object.fromEntries(header.map((h, i) => [h, i])) as Record<
    string,
    number
  >;

  const get = (cells: string[], key: string) => {
    const i = index[key];
    return i == null ? "" : (cells[i] ?? "");
  };

  const out: ClientRecord[] = [];
  for (const row of rows.slice(1)) {
    const cells = parseCsvLine(row);
    const id = get(cells, "id").trim();
    if (!id) continue;
    const genderRaw = get(cells, "gender").trim();
    const recettesRaw = get(cells, "recettes");
    const reasonsRaw = get(cells, "suspectReasons");
    out.push({
      id,
      gender: genderRaw === "H" || genderRaw === "F" ? genderRaw : null,
      lastName: get(cells, "lastName"),
      firstName: get(cells, "firstName"),
      birthDay: parseNullableInt(get(cells, "birthDay")),
      birthMonth: parseNullableInt(get(cells, "birthMonth")),
      birthYear: parseNullableInt(get(cells, "birthYear")),
      address: get(cells, "address"),
      phone: get(cells, "phone"),
      email: get(cells, "email"),
      recettes: recettesRaw
        ? recettesRaw.split(RECETTE_SEP).map((r) => r.trimEnd())
        : [""],
      firstVisitAt: get(cells, "firstVisitAt").trim() || null,
      lastVisitAt: get(cells, "lastVisitAt").trim() || null,
      isSuspect: get(cells, "isSuspect").trim() === "1",
      suspectReasons: reasonsRaw
        ? reasonsRaw
            .split(REASON_SEP)
            .map((r) => r.trim())
            .filter(Boolean)
        : [],
      validatedAt: get(cells, "validatedAt").trim() || null,
      createdAt: get(cells, "createdAt").trim() || new Date().toISOString(),
      updatedAt: get(cells, "updatedAt").trim() || new Date().toISOString(),
    });
  }
  return out;
}
