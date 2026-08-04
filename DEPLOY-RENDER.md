# Déploiement API sur Render

Front WordPress : [https://kod200.com/buca](https://kod200.com/buca)  
API : service Render (ex. `https://buca.onrender.com`)

Agenda = fichier **`bookings.json`** (plus d’OAuth Google en runtime).  
Jours fériés = API publique Nager.Date (CH / Zurich).

## 1. Web Service

| Champ | Valeur |
| --- | --- |
| **Build Command** | `npm install && npm run build:api` |
| **Start Command** | `npx next start -p $PORT` |
| **Instance** | Free ou payant + **disque** |

## 2. Variables d’environnement

| Variable | Exemple |
| --- | --- |
| `SALON_ADMIN_CODE` | ton code salon |
| `CORS_ORIGINS` | `https://kod200.com,https://www.kod200.com` |
| `DATA_DIR` | chemin du disque monté (ex. `/var/data`) — **fortement recommandé** |
| `NODE_VERSION` | `20` |

Google n’est plus nécessaire en runtime.

## 3. Persistance (important)

Sans `DATA_DIR` sur un volume, Render free écrit dans `/tmp` → **RDV et clients perdus** au sleep/redeploy.

1. Render → Disk → monte ex. `/var/data`
2. `DATA_DIR=/var/data`
3. Après migration locale, uploade `bookings.json` + `clients.json` dans ce dossier  
   (ou commit `data/*.json` pour seed au premier boot via copie bundlée)

## 4. Migration Google → bookings.json (une fois)

En local, avec un token Google encore valide :

```bash
npm run auth:google          # si invalid_grant
npm run bookings:migrate-google
```

Commit / copie `data/bookings.json` vers le serveur (`DATA_DIR` ou repo).

## 5. Vérifier

`https://TON-SERVICE.onrender.com/api/holidays` → JSON de dates (sans `invalid_grant`).

## 6. Front ReactPress

Voir [`DEPLOY-REACTPRESS.md`](DEPLOY-REACTPRESS.md) — upload `build/` + vider WP Super Cache.
