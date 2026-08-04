import { promises as fs } from "node:fs";
import path from "node:path";
import {
  computeCalculateurLines,
  selectionId,
  selectionLabel,
  sumMinutes,
  type CalculateurSelection,
} from "./calculateur";
import { getDataDir } from "./data-dir";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type EstimatesMap = Record<string, number>;

function estimatesPath(): string {
  return path.join(getDataDir(), "calculateur-estimates.json");
}

function hiddenPath(): string {
  return path.join(getDataDir(), "calculateur-hidden.json");
}

async function ensureFile(): Promise<void> {
  const DATA_DIR = getDataDir();
  const FILE_PATH = estimatesPath();
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    const bundled = path.join(
      process.cwd(),
      "data",
      "calculateur-estimates.json",
    );
    try {
      await fs.copyFile(bundled, FILE_PATH);
    } catch {
      await fs.writeFile(FILE_PATH, "{}\n", "utf8");
    }
  }
}

async function ensureHiddenFile(): Promise<void> {
  const DATA_DIR = getDataDir();
  const HIDDEN_PATH = hiddenPath();
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(HIDDEN_PATH);
  } catch {
    const bundled = path.join(process.cwd(), "data", "calculateur-hidden.json");
    try {
      await fs.copyFile(bundled, HIDDEN_PATH);
    } catch {
      await fs.writeFile(HIDDEN_PATH, "[]\n", "utf8");
    }
  }
}

export async function readEstimates(): Promise<EstimatesMap> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("calculateur_estimates")
      .select("id, minutes");
    if (error) throw new Error(`Supabase estimates: ${error.message}`);
    const out: EstimatesMap = {};
    for (const row of data ?? []) {
      if (typeof row.id === "string" && typeof row.minutes === "number") {
        out[row.id] = row.minutes;
      }
    }
    return out;
  }

  await ensureFile();
  const raw = await fs.readFile(estimatesPath(), "utf8");
  try {
    const parsed = JSON.parse(raw) as EstimatesMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveEstimate(
  id: string,
  minutes: number,
): Promise<EstimatesMap> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase()
      .from("calculateur_estimates")
      .upsert({ id, minutes });
    if (error) throw new Error(`Supabase save estimate: ${error.message}`);
    return readEstimates();
  }

  const estimates = await readEstimates();
  estimates[id] = minutes;
  await fs.writeFile(
    estimatesPath(),
    `${JSON.stringify(estimates, null, 2)}\n`,
    "utf8",
  );
  return estimates;
}

export async function deleteEstimate(id: string): Promise<EstimatesMap> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase()
      .from("calculateur_estimates")
      .delete()
      .eq("id", id);
    if (error) throw new Error(`Supabase delete estimate: ${error.message}`);
    return readEstimates();
  }

  const estimates = await readEstimates();
  delete estimates[id];
  await fs.writeFile(
    estimatesPath(),
    `${JSON.stringify(estimates, null, 2)}\n`,
    "utf8",
  );
  return estimates;
}

export async function readHiddenIds(): Promise<string[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabase()
      .from("calculateur_hidden")
      .select("id");
    if (error) throw new Error(`Supabase hidden: ${error.message}`);
    return (data ?? [])
      .map((r) => r.id)
      .filter((id): id is string => typeof id === "string");
  }

  await ensureHiddenFile();
  const raw = await fs.readFile(hiddenPath(), "utf8");
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export async function hideCombination(id: string): Promise<string[]> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabase()
      .from("calculateur_hidden")
      .upsert({ id });
    if (error) throw new Error(`Supabase hide: ${error.message}`);
    await deleteEstimate(id);
    return readHiddenIds();
  }

  const hidden = await readHiddenIds();
  if (!hidden.includes(id)) {
    hidden.push(id);
    await fs.writeFile(
      hiddenPath(),
      `${JSON.stringify(hidden, null, 2)}\n`,
      "utf8",
    );
  }
  await deleteEstimate(id);
  return hidden;
}

/** Remplace toutes les estimations (seed). */
export async function replaceAllEstimates(
  estimates: EstimatesMap,
): Promise<number> {
  if (isSupabaseConfigured()) {
    const sb = getSupabase();
    const { error: delErr } = await sb
      .from("calculateur_estimates")
      .delete()
      .not("id", "is", null);
    if (delErr) throw new Error(`Supabase estimates clear: ${delErr.message}`);
    const rows = Object.entries(estimates)
      .filter(([, m]) => typeof m === "number" && m > 0)
      .map(([id, minutes]) => ({ id, minutes }));
    if (rows.length) {
      const { error } = await sb.from("calculateur_estimates").insert(rows);
      if (error) throw new Error(`Supabase estimates seed: ${error.message}`);
    }
    return rows.length;
  }

  await ensureFile();
  await fs.writeFile(
    estimatesPath(),
    `${JSON.stringify(estimates, null, 2)}\n`,
    "utf8",
  );
  return Object.keys(estimates).length;
}

/** Remplace les IDs masqués (seed). */
export async function replaceAllHiddenIds(ids: string[]): Promise<number> {
  const clean = ids.filter((id) => typeof id === "string" && id.length > 0);
  if (isSupabaseConfigured()) {
    const sb = getSupabase();
    const { error: delErr } = await sb
      .from("calculateur_hidden")
      .delete()
      .not("id", "is", null);
    if (delErr) throw new Error(`Supabase hidden clear: ${delErr.message}`);
    if (clean.length) {
      const { error } = await sb
        .from("calculateur_hidden")
        .insert(clean.map((id) => ({ id })));
      if (error) throw new Error(`Supabase hidden seed: ${error.message}`);
    }
    return clean.length;
  }

  await ensureHiddenFile();
  await fs.writeFile(
    hiddenPath(),
    `${JSON.stringify(clean, null, 2)}\n`,
    "utf8",
  );
  return clean.length;
}

export type ResolvedDuration = {
  id: string;
  label: string;
  calculatedMinutes: number;
  estimatedMinutes: number | null;
  /** Temps estimé s’il existe, sinon temps calculé. */
  minutes: number;
};

export async function resolveDurationForSelection(
  selection: CalculateurSelection,
): Promise<ResolvedDuration | null> {
  const lines = computeCalculateurLines(selection);
  if (lines.length === 0) return null;

  const id = selectionId(selection);
  const calculatedMinutes = sumMinutes(lines);
  const estimates = await readEstimates();
  const estimatedMinutes =
    typeof estimates[id] === "number" && estimates[id] > 0
      ? estimates[id]
      : null;

  return {
    id,
    label: selectionLabel(selection),
    calculatedMinutes,
    estimatedMinutes,
    minutes: estimatedMinutes ?? calculatedMinutes,
  };
}
