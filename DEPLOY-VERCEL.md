# Déploiement API sur Vercel

Front WordPress : [https://kod200.com/buca](https://kod200.com/buca)  
API Node : projet Vercel (ex. `https://reservsalon-xxx.vercel.app`)

## 1. Créer le projet Vercel

1. [vercel.com](https://vercel.com) → Import du repo Git **Reservsalon** (ou upload CLI).
2. Framework : **Next.js** (détecté via `vercel.json`).
3. Build Command : `npm run build:api` (déjà dans `vercel.json`).

## 2. Variables d’environnement (Vercel → Settings → Environment Variables)

| Variable | Exemple |
| --- | --- |
| `GOOGLE_CLIENT_ID` | … |
| `GOOGLE_CLIENT_SECRET` | … |
| `GOOGLE_REFRESH_TOKEN` | … |
| `GOOGLE_CALENDAR_ID` | `redroomcoiffure@gmail.com` |
| `SALON_ADMIN_CODE` | ton code salon |
| `CORS_ORIGINS` | `https://kod200.com,https://www.kod200.com` |

Optionnel : `GOOGLE_HOLIDAYS_CALENDAR_ID`, `DATA_DIR` (défaut Vercel = `/tmp/…`).

Redeploy après avoir sauvé les variables.

## 3. Vérifier l’API

Ouvre : `https://TON-PROJET.vercel.app/api/holidays`  
→ JSON avec des dates = OK.

## 4. Build du front ReactPress

```bash
VITE_API_BASE=https://TON-PROJET.vercel.app npm run build
```

Uploade `dist/` → `wp-content/reactpress/apps/buca/dist/`  
Page : [https://kod200.com/buca](https://kod200.com/buca)

## 5. Persistance (important)

Sur Vercel, le fichier clients est en **`/tmp`** (éphémère) : il peut être perdu au redeploy / cold start.

- L’**agenda Google** reste la source de vérité des RDV.
- Fais des **Backup CSV** réguliers (Mes RDVs → Fichier clients).
- Pour une base clients durable plus tard : VPS avec disque, ou stockage type Blob/DB.

## 6. CLI (optionnel)

```bash
npx vercel login
npx vercel --prod
```
