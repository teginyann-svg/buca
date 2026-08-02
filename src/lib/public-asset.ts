/** Assets publics (images dans /public ou build/). */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, "");
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as ImportMeta & {
          env?: { BASE_URL?: string; VITE_PUBLIC_ASSET_BASE?: string };
        }).env
      : undefined;

  const absolute = env?.VITE_PUBLIC_ASSET_BASE?.trim();
  if (absolute) {
    return `${absolute.replace(/\/?$/, "/")}${clean}`;
  }

  const base = env?.BASE_URL;
  if (typeof base === "string" && base.length > 0 && base !== "/") {
    return `${base}${clean}`;
  }
  return `/${clean}`;
}
