import path from "node:path";

/**
 * Répertoire des JSON locaux (clients, device-bookings, estimates).
 * Sur Vercel le FS du projet est en lecture seule → /tmp (éphémère).
 * Pour une vraie persistance : VPS / volume, ou Backup CSV régulier.
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
