import path from "node:path";

/**
 * Répertoire des JSON locaux (clients, bookings, device-bookings, estimates).
 * Utilisé seulement si Supabase n’est pas configuré.
 * Sur Render sans Supabase ni volume : /tmp (éphémère).
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
