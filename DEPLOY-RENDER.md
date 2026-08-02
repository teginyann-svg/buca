# Déploiement API sur Render

Front WordPress : [https://kod200.com/buca](https://kod200.com/buca)  
API Node : service Render (ex. `https://reservsalon.onrender.com`)

## 1. Créer le Web Service

1. Va sur [render.com](https://render.com) → **New** → **Web Service**.
2. Connecte le repo Git **Reservsalon** (ou déploie depuis un zip / CLI).
3. Réglages :

| Champ | Valeur |
| --- | --- |
| **Name** | `reservsalon-api` (ou autre) |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build:api` |
| **Start Command** | `npx next start -p $PORT` |
| **Instance** | Free |

## 2. Variables d’environnement (Environment)

| Variable | Exemple |
| --- | --- |
| `GOOGLE_CLIENT_ID` | … |
| `GOOGLE_CLIENT_SECRET` | … |
| `GOOGLE_REFRESH_TOKEN` | … |
| `GOOGLE_CALENDAR_ID` | `redroomcoiffure@gmail.com` |
| `SALON_ADMIN_CODE` | ton code salon |
| `CORS_ORIGINS` | `https://kod200.com,https://www.kod200.com` |
| `NODE_VERSION` | `20` |

Optionnel : `GOOGLE_HOLIDAYS_CALENDAR_ID`.

**Save** → attends le premier deploy (quelques minutes).

## 3. Vérifier l’API

Ouvre : `https://TON-SERVICE.onrender.com/api/holidays`  

→ JSON avec des dates = OK.  
Au premier appel après inactivité, attends 30–60 s (cold start free).

## 4. Build du front ReactPress

```bash
VITE_API_BASE=https://TON-SERVICE.onrender.com npm run build
```

Uploade **tout** le contenu de `dist/` vers :

```
wp-content/reactpress/apps/buca/dist/
```

(App ReactPress créée en mode **Vite**. Détail : `DEPLOY-REACTPRESS.md`.)

Page : [https://kod200.com/buca](https://kod200.com/buca)

## 5. Limites du plan Free

- Le service **s’endort** après ~15 min sans trafic → 1re requête lente.
- Disque **éphémère** (`/tmp/reservsalon-data`) : `clients.json` / `clients.csv`
  sont **effacés** au sleep ou redeploy. Après redémarrage, l’API repart du
  fichier bundlé du repo (souvent vide / ancien).
  - **RDV** = Google Calendar (pas touchés).
  - **Fiches clients** = Backup CSV + Import CSV après chaque période importante,
    ou disque persistant Render + variable `DATA_DIR=/var/data` (ou chemin du mount).

## 6. Blueprint optionnel

Le fichier `render.yaml` peut être utilisé (Render → New → Blueprint) si le repo est sur GitHub/GitLab.
