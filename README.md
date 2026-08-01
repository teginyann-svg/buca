# Reservsalon — réservation Red Room Coiffure

Page web simple pour réserver une séance de **1h30**. Les créneaux disponibles sont calculés à partir de l’agenda Google `redroomcoiffure@gmail.com`, et chaque réservation crée un événement dans cet agenda.

## Prérequis

- Node.js 20+
- Un projet [Google Cloud](https://console.cloud.google.com/) avec le compte `redroomcoiffure@gmail.com`

## Configuration Google Cloud (une fois)

1. Créez un projet (ou réutilisez-en un) et activez **Google Calendar API**.
2. **APIs & Services → OAuth consent screen** : type *External* (ou Internal si Google Workspace). Ajoutez votre email comme test user si l’app est en mode Testing.
3. **Credentials → Create credentials → OAuth client ID** : type **Web application**.
4. Ajoutez l’URI de redirection :
   - `http://localhost:3456/oauth2callback` (script d’auth)
5. Copiez le **Client ID** et le **Client secret**.

## Installation locale

```bash
cp .env.example .env.local
# Remplir GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET
npm install
npm run auth:google
```

Ouvrez l’URL affichée, connectez-vous avec **redroomcoiffure@gmail.com**, acceptez les permissions, puis collez le `GOOGLE_REFRESH_TOKEN` affiché dans `.env.local`.

Vérifiez aussi :

```env
GOOGLE_CALENDAR_ID=redroomcoiffure@gmail.com
```

## Lancer l’app (développement)

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) (ou `/#/`).  
Espace salon : [http://localhost:3000/#/semaine](http://localhost:3000/#/semaine) · clients `/#/clients`.

Si le port 3000 est occupé par un ancien process : fermez-le, ou `npx next dev -p 3010`.

Build front ReactPress : `npm run build` → dossier **`dist/`**.  
Prod : [https://kod200.com/buca](https://kod200.com/buca)  
API Render : [`DEPLOY-RENDER.md`](DEPLOY-RENDER.md) · Front WP : [`DEPLOY-REACTPRESS.md`](DEPLOY-REACTPRESS.md).

## Page semaine (salon)

Récap des clientes de la semaine + suppression de créneaux : [http://localhost:3000/semaine](http://localhost:3000/semaine)

1. Ajoutez dans `.env.local` un code secret :
   ```env
   SALON_ADMIN_CODE=votre-code-secret
   ```
2. Ouvrez `/semaine`, entrez le code
3. Naviguez entre les semaines, **Effacer** pour supprimer un rendez-vous de Google Calendar

## Fonctionnement

| Étape | Détail |
| --- | --- |
| Date | Jours ouverts uniquement (mer–ven 9h–19h, sam 9h–17h) |
| Créneaux | Tranches de 90 min dans les horaires d’ouverture (Europe/Zurich), hors plages déjà occupées dans Google Calendar |
| Réservation | Crée un événement « Réservation — {nom} » avec le téléphone dans la description |
| Semaine | Liste lundi–dimanche des événements de l’agenda ; effacer = suppression Google Calendar |

## Personnaliser horaires / durée

Éditez [`src/lib/config.ts`](src/lib/config.ts) :

- `SLOT_DURATION_MINUTES` — durée d’une séance
- `OPENING_HOURS` — jours et heures d’ouverture
- `BOOKING_HORIZON_DAYS` — combien de jours à l’avance on peut réserver
- `MIN_LEAD_MINUTES` — délai minimum avant un créneau

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et prod |
| `npm run auth:google` | Obtenir le refresh token Google |

## Déploiement

Déployez sur Vercel (ou équivalent) et définissez les mêmes variables d’environnement. Aucune base de données n’est requise : Google Calendar est la source de vérité.
