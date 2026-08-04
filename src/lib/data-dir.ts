import path from "node:path";

/**
 * Répertoire des JSON locaux (clients, bookings, device-bookings, estimates).
 * Sur Render/Vercel sans volume : /tmp (éphémère → perdu au sleep/redeploy).
 * Pour persister : monter un disque et définir DATA_DIR.
 * Les RDV sont dans bookings.json (plus Google OAuth en runtime).
 */
export function getDataDir(): string {
  if (process.env.DATA_DIR?.trim()) {
    return process.env.DATA_DIR.trim();
  }
  if (process.env.VERCEL || process.env.RENDER) {
    return path.join("/tmp", "reservsalon-data");
  }
  return path.join(process.cwd(), "data");
}
