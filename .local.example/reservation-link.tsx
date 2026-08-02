import type { ReactNode } from "react";

/**
 * Exemple — copier vers `.local/reservation-link.tsx` (dossier gitignored).
 * Ne pas committer le vrai `.local/` : le lien reste hors git et hors build prod.
 */
export default function LocalReservationLink(): ReactNode {
  return (
    <p style={{ margin: "12px 0 0", fontSize: 13, textAlign: "center" }}>
      <a href="/__local/update-guide.html" target="_blank" rel="noreferrer">
        Marche à suivre — maj contenu / fonctionnalités (local)
      </a>
    </p>
  );
}
