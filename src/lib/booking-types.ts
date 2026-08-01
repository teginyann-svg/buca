export type WeekBooking = {
  id: string;
  clientName: string;
  clientPhone: string | null;
  start: string;
  end: string;
  summary: string;
  servicesLabel: string | null;
  durationMinutes: number | null;
  /** Téléphone absent du fichier clients au moment de la résa. */
  isNewClient: boolean;
  /** Plusieurs réservations depuis le même appareil. */
  sameDevice: boolean;
  /** Numéro hors Suisse. */
  nonSwissPhone: boolean;
  /** Numéro au motif généré / factice. */
  generatedPhone: boolean;
  /** Email jetable / temporaire. */
  disposableEmail: boolean;
  deviceId: string | null;
  email: string | null;
};
