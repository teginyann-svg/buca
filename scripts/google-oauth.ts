/**
 * Script OAuth pour obtenir un refresh token Google (agenda du salon).
 *
 * Usage :
 *   1. Copier .env.example → .env.local et renseigner GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   2. npm run auth:google
 *   3. Ouvrir l’URL affichée, se connecter avec redroomcoiffure@gmail.com, accepter
 *   4. Coller GOOGLE_REFRESH_TOKEN dans .env.local
 */
import http from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { google } from "googleapis";
import { GOOGLE_SCOPES } from "../src/lib/google-calendar";

const projectDir = dirname(fileURLToPath(import.meta.url)) + "/..";
loadEnvConfig(projectDir);

const PORT = 3456;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Renseignez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans .env.local avant de lancer ce script.",
    );
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    // Interface Google (écran de connexion / consentement) en français
    hl: "fr",
  });

  console.log(
    "\n1. Ajoutez cette URI de redirection dans Google Cloud Console → Identifiants → votre client OAuth :",
  );
  console.log(`   ${REDIRECT_URI}`);
  console.log(
    "\n2. Ouvrez cette URL dans le navigateur et connectez-vous avec redroomcoiffure@gmail.com :\n",
  );
  console.log(authUrl);
  console.log("\nEn attente de la réponse Google…\n");

  const refreshToken = await new Promise<string>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith("/oauth2callback")) {
          res.writeHead(404);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost:${PORT}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end(`Erreur OAuth : ${error}`);
          server.close();
          reject(new Error(error));
          return;
        }

        if (!code) {
          res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Code manquant");
          return;
        }

        const { tokens } = await oauth2.getToken(code);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<h1>OK</h1><p>Vous pouvez fermer cette fenêtre et revenir au terminal.</p>",
        );
        server.close();

        if (!tokens.refresh_token) {
          reject(
            new Error(
              "Aucun refresh_token reçu. Révoquez l’accès sur https://myaccount.google.com/permissions puis relancez npm run auth:google.",
            ),
          );
          return;
        }

        resolve(tokens.refresh_token);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(PORT);
  });

  console.log("\nAjoutez ceci dans .env.local :\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${refreshToken}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
