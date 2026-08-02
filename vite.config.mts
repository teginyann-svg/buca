import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localDir = path.resolve(__dirname, ".local");
const localLinkPath = path.join(localDir, "reservation-link.tsx");
const localGuidePath = path.join(localDir, "update-guide.html");
const emptyLocalLink = path.resolve(__dirname, "src/lib/empty-local-link.tsx");

/** ReactPress (mode CRA) lit build/asset-manifest.json pour injecter JS/CSS. */
function reactpressAssetManifest(): Plugin {
  return {
    name: "reactpress-asset-manifest",
    closeBundle() {
      const outDir = path.resolve(__dirname, "build");
      const staticDir = path.join(outDir, "static");
      if (!fs.existsSync(staticDir)) return;

      const files = fs.readdirSync(staticDir);
      const js = files.filter((f) => f.endsWith(".js")).sort();
      const css = files.filter((f) => f.endsWith(".css")).sort();
      js.sort((a, b) => {
        const ai = a.startsWith("index") ? 0 : 1;
        const bi = b.startsWith("index") ? 0 : 1;
        return ai - bi || a.localeCompare(b);
      });

      const entrypoints = [
        ...css.map((f) => `static/${f}`),
        ...js.map((f) => `static/${f}`),
      ];
      const manifest = {
        files: Object.fromEntries([
          ...css.map((f) => [`static/${f}`, `/static/${f}`]),
          ...js.map((f) => [`static/${f}`, `/static/${f}`]),
          ["index.html", "/index.html"],
        ]),
        entrypoints,
      };
      fs.writeFileSync(
        path.join(outDir, "asset-manifest.json"),
        JSON.stringify(manifest, null, 2),
      );
    },
  };
}

/** Sert `.local/update-guide.html` uniquement via le serveur de dev Vite. */
function localUpdateGuide(): Plugin {
  return {
    name: "local-update-guide",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/__local/update-guide.html") {
          next();
          return;
        }
        if (!fs.existsSync(localGuidePath)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.end(
            "Fichier manquant : .local/update-guide.html\nVoir .local.example/README.md",
          );
          return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(fs.readFileSync(localGuidePath));
      });
    },
  };
}

/**
 * Build ReactPress mode CRA → dossier `build/` + asset-manifest.json
 * Page WP : https://kod200.com/buca
 *
 * Lien « marche à suivre » : alias `@local/reservation-link` pointe vers
 * `.local/` uniquement en `development` si le fichier existe — jamais en build prod.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3001";
  const base = env.VITE_BASE || "./";
  const useLocalLink =
    mode === "development" && fs.existsSync(localLinkPath);

  return {
    plugins: [react(), reactpressAssetManifest(), localUpdateGuide()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@local/reservation-link": useLocalLink
          ? localLinkPath
          : emptyLocalLink,
      },
    },
    base,
    publicDir: "public",
    build: {
      outDir: "build",
      assetsDir: "static",
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
