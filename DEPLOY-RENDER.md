# Déploiement API sur Render

Front WordPress : [https://kod200.com/buca](https://kod200.com/buca)  
API : service Render (ex. `https://buca.onrender.com`)

Agenda / clients / appareils = **Supabase Postgres** (gratuit).  
Jours fériés = API publique Nager.Date (CH / Zurich).

## 1. Web Service

| Champ | Valeur |
| --- | --- |
| **Build Command** | `npm install && npm run build:api` |
| **Start Command** | `npx next start -p $PORT` |
| **Instance** | Free (pas besoin de disque si Supabase est configuré) |

## 2. Variables d’environnement

| Variable | Exemple |
| --- | --- |
| `SALON_ADMIN_CODE` | ton code salon |
| `CORS_ORIGINS` | `https://kod200.com,https://www.kod200.com` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | clé **service_role** (jamais le front) |
| `NODE_VERSION` | `20` |

## 3. Supabase (persistance free)

1. Créer un projet [Supabase](https://supabase.com) (région EU si possible).
2. SQL Editor → exécuter [`supabase/schema.sql`](supabase/schema.sql).
3. Settings → API : copier **Project URL** + **service_role**.
4. En local : les mettre dans `.env.local`, puis :

```bash
npm run data:seed-supabase
```

5. Sur Render : mêmes `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → Redeploy.

Sans ces variables, l’API retombe sur des JSON locaux (`DATA_DIR` ou `/tmp` sur Render free → **éphémère**).

## 4. Migration Google → JSON (une fois, optionnel)

```bash
npm run auth:google
npm run bookings:migrate-google
npm run data:seed-supabase
```

## 5. Vérifier

`https://TON-SERVICE.onrender.com/api/holidays` → JSON de dates.

## 6. Front ReactPress

Voir [`DEPLOY-REACTPRESS.md`](DEPLOY-REACTPRESS.md) — upload `build/` + vider WP Super Cache.
