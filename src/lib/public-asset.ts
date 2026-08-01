/** Préfixe assets publics (Vite `base: './'` ou Next `/`). */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, "");
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env
      : undefined;
  const base = env?.BASE_URL;
  if (typeof base === "string" && base.length > 0 && base !== "/") {
    return `${base}${clean}`;
  }
  return `/${clean}`;
}
