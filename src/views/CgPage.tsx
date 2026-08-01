import { Link } from "react-router-dom";
import { SALON_NAME } from "@/lib/config";
import {
  SALON_CALL_PHONE_DISPLAY,
  SALON_CALL_PHONE_TEL,
} from "@/lib/swiss-phone";

export default function ConditionsPage() {
  return (
    <main className="salon-shell">
      <header className="salon-brand">
        <p className="salon-brand__eyebrow">Informations</p>
        <h1 className="salon-brand__name">Conditions &amp; confidentialité</h1>
        <p className="salon-brand__tagline">{SALON_NAME}</p>
      </header>

      <div className="salon-card">
        <div className="salon-card__accent" />
        <div className="salon-card__body salon-legal">
          <section className="salon-section">
            <h2 className="salon-legal__title">Réservation</h2>
            <p>
              La réservation en ligne propose un créneau selon les disponibilités
              de l’agenda. La confirmation affichée à l’écran vaut prise en
              compte du rendez-vous.
            </p>
            <p>
              Pour <strong>annuler ou modifier</strong>, contactez le salon par
              WhatsApp ou téléphone au{" "}
              <a href={`tel:${SALON_CALL_PHONE_TEL}`}>
                {SALON_CALL_PHONE_DISPLAY}
              </a>{" "}
              dans un délai raisonnable, afin de libérer le créneau.
            </p>
          </section>

          <section className="salon-section">
            <h2 className="salon-legal__title">Données personnelles</h2>
            <p>
              Les informations collectées (prénom, nom éventuel, téléphone,
              e-mail optionnel, services choisis) servent uniquement à gérer les
              rendez-vous et le suivi cliente du salon.
            </p>
            <p>
              Elles sont conservées dans l’agenda et le fichier clients du salon.
              Vous pouvez demander l’accès, la correction ou la suppression de
              vos données en contactant le salon aux coordonnées ci-dessus.
            </p>
          </section>

          <section className="salon-section">
            <h2 className="salon-legal__title">Responsabilité</h2>
            <p>
              En cas d’imprévu (retard, indisponibilité), le salon peut proposer
              un autre créneau. Les informations affichées en ligne sont données
              à titre indicatif ; l’agenda du salon fait foi.
            </p>
          </section>

          <div className="salon-section salon-section--actions">
            <Link to="/" className="salon-footer__link">
              ← Retour à la réservation
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
