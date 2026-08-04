# Reservsalon — réservation Red Room Coiffure

Page web pour réserver une séance. Les créneaux et RDV sont stockés en
**agenda interne** (`data/bookings.json` / `DATA_DIR`), sans OAuth Google en
production. Les jours fériés CH viennent de l’API publique [Nager.Date](https://date.nager.at/).

## Prérequis

- Node.js 20+

## Installation locale

```bash
cp .env.example .env.local
# Renseigner SALON_ADMIN_CODE
npm install
```

### Migration des RDV déjà pris (Google → fichier local)

Si tu as encore un refresh token Google valide :

```bash
# .env.local : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_CALENDAR_ID
npm run auth:google   # seulement si invalid_grant
npm run bookings:migrate-google
```

Cela écrit `data/bookings.json` avec tous les RDV Agenda existants.

## Lancer l’app (développement)

```bash
npm run dev:vite
```

- UI : [http://localhost:3000](http://localhost:3000)
- API : [http://localhost:3001](http://localhost:3001)

## Production

- **API** : Render (ou VPS) avec **disque persistant** + `DATA_DIR`  
  Voir [`DEPLOY-RENDER.md`](DEPLOY-RENDER.md)
- **Front** : ReactPress → [`DEPLOY-REACTPRESS.md`](DEPLOY-REACTPRESS.md)

Variables runtime essentielles :

```env
SALON_ADMIN_CODE=…
DATA_DIR=/var/data          # recommandé en prod
CORS_ORIGINS=https://kod200.com,https://www.kod200.com
```

Google n’est **plus requis** pour le runtime (uniquement pour la migration one-shot).
