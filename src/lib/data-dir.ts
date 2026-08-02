import path from "node:path";

/**
 * Répertoire des JSON locaux (clients, device-bookings, estimates).
 * Sur Render/Vercel sans volume : /tmp (éphémère → perdu au sleep/redeploy).
 * Pour persister : monter un disque et définir DATA_DIR, + Backup CSV régulier.
 * Les RDV restent dans Google Calendar (indépendant de ce dossier).
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
