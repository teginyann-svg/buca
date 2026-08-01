# Déploiement WordPress / ReactPress

**Page publique :** [https://kod200.com/buca](https://kod200.com/buca)  
(Slug ReactPress / page WP : `buca`)

API Node : déployer sur **Render** — guide [`DEPLOY-RENDER.md`](DEPLOY-RENDER.md)  
(Alternative : [`DEPLOY-VERCEL.md`](DEPLOY-VERCEL.md) si CB OK.)

Reservsalon est découpé en deux parties :

| Partie | Techno | Livrable |
| --- | --- | --- |
| Interface | Vite + React | dossier **`dist/`** → ReactPress app `buca` |
| API | Next.js (`/api/*`) | hébergeur Node (Vercel, Railway, VPS…) |

## 1. API Node

1. Copiez `.env.example` → variables Google + `SALON_ADMIN_CODE` sur l’hébergeur.
2. `CORS_ORIGINS` doit inclure `https://kod200.com` (défaut + `.env.example`).
3. Build & start :
   ```bash
   npm run build:api
   npm run start:api
   ```
   Ou déployez le projet Next sur Vercel (les routes `/api/*` suffisent).
4. Notez l’URL publique, ex. `https://api.kod200.com`.

Préférez un hébergeur avec **disque persistant** pour `data/clients.json` et `data/clients.csv`.

## 2. Front ReactPress (`dist`)

1. Créez `.env.production` (ou exportez la variable) :
   ```env
   VITE_API_BASE=https://api.kod200.com
   ```
2. Build :
   ```bash
   npm run build
   ```
3. ReactPress → app **`buca`**, page slug `/buca`.
4. Uploadez le **contenu** de `dist/` vers :
   ```
   wp-content/reactpress/apps/buca/dist/
   ```
5. Mise à jour : **supprimez** l’ancien `dist` puis uploadez le nouveau.

URLs en ligne :
- Réservation : https://kod200.com/buca · https://kod200.com/buca/#/
- Mes RDVs : https://kod200.com/buca/#/semaine
- Clients : https://kod200.com/buca/#/clients

(`base: './'` — assets relatifs, adaptés à ReactPress.)

## 3. Développement local

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

## 4. Checklist

- [ ] API HTTPS + `CORS_ORIGINS=https://kod200.com`
- [ ] `VITE_API_BASE` au `npm run build`
- [ ] `dist/` dans `reactpress/apps/buca/dist`
- [ ] Page WP → [https://kod200.com/buca](https://kod200.com/buca)
