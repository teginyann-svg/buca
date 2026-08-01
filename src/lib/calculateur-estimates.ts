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

export async function readEstimates(): Promise<EstimatesMap> {
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
  const estimates = await readEstimates();
  delete estimates[id];
  await fs.writeFile(
    estimatesPath(),
    `${JSON.stringify(estimates, null, 2)}\n`,
    "utf8",
  );
  return estimates;
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

export async function readHiddenIds(): Promise<string[]> {
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
