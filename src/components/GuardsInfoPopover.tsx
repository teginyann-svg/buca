"use client";

import { SafetyOutlined } from "@ant-design/icons";
import { Button, Popover } from "antd";

function GuardsContent() {
  return (
    <div className="salon-guards">
      <p className="salon-guards__lead">
        Protections automatiques contre les abus de réservation.
      </p>

      <p className="salon-guards__heading">Signalements</p>
      <ul className="salon-guards__list">
        <li>
          <strong>Nouvelle cliente</strong> — numéro inconnu du fichier
        </li>
        <li>
          <strong>Provient d’un même appareil</strong> — plusieurs RDV depuis
          le même appareil
        </li>
        <li>
          <strong>N° non-suisse</strong> — indicatif hors Suisse
        </li>
        <li>
          <strong>N° généré</strong> — motif factice / générateur
        </li>
        <li>
          <strong>Email jetable</strong> — adresse temporaire
        </li>
      </ul>

      <p className="salon-guards__heading">Confirmation</p>
      <ul className="salon-guards__list">
        <li>
          Même appareil = normal ; plusieurs RDV d’un coup surtout si
          cliente connue
        </li>
        <li>
          Hors fichier : 2<sup>e</sup> RDV le même jour → « Êtes-vous
          sûr(e)… »
        </li>
        <li>
          Hors fichier : 3<sup>e</sup> RDV la même semaine → même
          question
        </li>
        <li>
          Cliente du fichier → plusieurs RDV sans cette confirmation
        </li>
        <li>
          Si oui → RDV créé + marquage « Provient d’un même appareil »
        </li>
        <li>
          Si non → aucun RDV ; le créneau reste libre
        </li>
      </ul>

      <p className="salon-guards__heading">Disponibilités</p>
      <ul className="salon-guards__list">
        <li>Aucun créneau → appeler ou WhatsApp</li>
        <li>Jour férié → salon fermé (sans appel)</li>
      </ul>
    </div>
  );
}

export function GuardsInfoPopover() {
  return (
    <Popover
      trigger="click"
      placement="bottom"
      arrow={{ pointAtCenter: true }}
      overlayClassName="salon-guards-popover"
      content={<GuardsContent />}
      title="Gardes-fous"
    >
      <Button
        type="text"
        className="salon-guards-trigger"
        icon={<SafetyOutlined />}
        aria-label="Voir les gardes-fous anti-abus"
      />
    </Popover>
  );
}
