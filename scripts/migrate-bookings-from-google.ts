/**
 * Migration one-shot : RDV Google Agenda → data/bookings.json
 * (nécessite encore GOOGLE_* une dernière fois).
 *
 * Usage : npm run bookings:migrate-google
 */
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

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
// .env.local wins (ex. nouveau GOOGLE_REFRESH_TOKEN après auth:google)
loadEnvSync(path.join(process.cwd(), ".env.local"), { override: true });

async function main() {
  const { listWeekBookings } = await import("../src/lib/google-calendar");
  const { TIMEZONE } = await import("../src/lib/config");
  type StoredBooking = import("../src/lib/bookings").StoredBooking;

  const start = dayjs.tz("2025-01-01", TIMEZONE).startOf("day");
  const end = dayjs().tz(TIMEZONE).add(400, "day").endOf("day");
  const raw = [];
  let cursor = start;
  while (cursor.isBefore(end)) {
    const next = cursor.add(1, "month");
    const chunk = await listWeekBookings(
      cursor.toISOString(),
      next.toISOString(),
    );
    raw.push(...chunk);
    cursor = next;
  }

  console.log(`Google: ${raw.length} événement(s)`);

  const byGoogleId = new Map<string, StoredBooking>();
  for (const b of raw) {
    if (byGoogleId.has(b.id)) continue;
    byGoogleId.set(b.id, {
      id: randomUUID(),
      start: b.start,
      end: b.end,
      clientName: b.clientName,
      clientPhone: b.clientPhone,
      email: b.email,
      servicesLabel: b.servicesLabel,
      durationMinutes: b.durationMinutes,
      isNewClient: b.isNewClient,
      sameDevice: b.sameDevice,
      nonSwissPhone: b.nonSwissPhone,
      generatedPhone: b.generatedPhone,
      disposableEmail: b.disposableEmail,
      deviceId: b.deviceId,
      summary: b.summary,
      createdAt: new Date().toISOString(),
      googleEventId: b.id,
    });
  }

  const stored = [...byGoogleId.values()].sort((a, b) =>
    a.start.localeCompare(b.start),
  );

  const dataDir = path.join(process.cwd(), "data");
  await fs.mkdir(dataDir, { recursive: true });
  const outPath = path.join(dataDir, "bookings.json");
  await fs.writeFile(outPath, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
  console.log(`Écrit ${stored.length} RDV → ${outPath}`);

  // Si DATA_DIR runtime = data/, prêt. Sinon copier aussi vers getDataDir().
  const { getDataDir } = await import("../src/lib/data-dir");
  const runtimeDir = getDataDir();
  if (path.resolve(runtimeDir) !== path.resolve(dataDir)) {
    await fs.mkdir(runtimeDir, { recursive: true });
    const runtimePath = path.join(runtimeDir, "bookings.json");
    await fs.writeFile(
      runtimePath,
      `${JSON.stringify(stored, null, 2)}\n`,
      "utf8",
    );
    console.log(`Aussi copié → ${runtimePath}`);
  }

  console.log("OK — l’API lit désormais bookings.json (plus besoin d’OAuth runtime).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
