# ReactPress — kod200.com/buca

API : `https://buca.onrender.com`  
Front : dossier **`build/`** (avec `asset-manifest.json`) →
`wp-content/reactpress/apps/buca/build/`

## Après un changement (contenu / fonctionnalités)

1. **Local** : `npm run dev` — tester UI + API.
2. **API** (si code `/api` ou secrets changés) : redeploy Render (`buca`).
3. **Front** :
   ```bash
   npm run build
   ```
   Vérifier `build/asset-manifest.json` + `build/static/`.
4. **FTP** : remplacer
   `wp-content/reactpress/apps/buca/build/`  
   par le dossier local `build/` (pas de `dist/` à côté).
5. **Vérifier** : https://kod200.com/buca/ (+ `/#/semaine`, `/#/clients`).

En local uniquement : lien « marche à suivre » sur la page réservation via le dossier
gitignored `.local/` (voir `.local.example/README.md`). Ce lien n’entre ni dans git
ni dans le `build/` déployé.

---

## Première install / reprise from scratch

### Préparer le build

```bash
cd ~/Desktop/Reservsalon
npm run build
```

### Structure serveur

```
wp-content/reactpress/apps/buca/build/
  asset-manifest.json
  index.html
  static/
  *.png
```

### Lier la page WP

ReactPress → app `buca` → lier la page slug `buca`.

### Checklist

- [ ] Uniquement `build/` (pas `dist/` en parallèle)
- [ ] `asset-manifest.json` présent
- [ ] Page WP liée à l’app dans ReactPress
- [ ] JS injecté (plus de `#root` vide)
- [ ] API Render + `CORS_ORIGINS` pour `https://kod200.com`
