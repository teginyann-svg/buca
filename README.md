# Reservsalon — réservation Red Room Coiffure

Page web pour réserver une séance. Les créneaux et RDV sont stockés en
**agenda interne** : **Supabase Postgres** en prod (Render free), ou fichiers
`data/*.json` en local sans credentials. Les jours fériés CH viennent de
l’API publique [Nager.Date](https://date.nager.at/).

## Prérequis

- Node.js 20+
- (Prod) projet [Supabase](https://supabase.com) free

## Installation locale

```bash
cp .env.example .env.local
# Renseigner SALON_ADMIN_CODE
# Optionnel : SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
```

Sans Supabase, l’API lit/écrit `data/` (ou `DATA_DIR`).

### Seed vers Supabase

1. Exécuter [`supabase/schema.sql`](supabase/schema.sql) dans le SQL Editor.
2. Renseigner `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` dans `.env.local`.
3. `npm run data:seed-supabase`

### Migration des RDV déjà pris (Google → JSON, optionnel)

```bash
# .env.local : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID
npm run auth:google   # seulement si invalid_grant
npm run bookings:migrate-google
npm run data:seed-supabase   # si Supabase est configuré
```

## Lancer l’app (développement)

```bash
npm run dev:vite
```

- UI : [http://localhost:3000](http://localhost:3000)
- API : [http://localhost:3001](http://localhost:3001)

## Production

- **API** : Render free + Supabase — [`DEPLOY-RENDER.md`](DEPLOY-RENDER.md)
- **Front** : ReactPress → [`DEPLOY-REACTPRESS.md`](DEPLOY-REACTPRESS.md)

```env
SALON_ADMIN_CODE=…
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=…
CORS_ORIGINS=https://kod200.com,https://www.kod200.com
```

Google n’est **plus requis** pour le runtime (uniquement pour la migration one-shot).
