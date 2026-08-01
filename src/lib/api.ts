/**
 * Base URL de l’API Node (sans slash final).
 * En Next (même origine) : laisser vide.
 * En Vite/ReactPress : `VITE_API_BASE=https://api…`
 */
export function getApiBase(): string {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env
      : undefined;
  const raw = env?.VITE_API_BASE ?? "";
  return String(raw).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(apiUrl(path), init);
}
