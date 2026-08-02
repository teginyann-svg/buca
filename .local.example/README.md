# Espace local (non versionné)

Ce dossier **n’est pas committé**. Il sert uniquement à ta machine.

## Activer le lien sur la page réservation

```bash
mkdir -p .local
cp .local.example/reservation-link.tsx .local/
cp .local.example/update-guide.html .local/
```

Puis `npm run dev` → sur `/` un lien ouvre la marche à suivre.

- Absent de `git status` (voir `.gitignore`)
- Absent du `build/` ReactPress / site kod200.com
