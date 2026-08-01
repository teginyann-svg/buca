export type ClientGender = "H" | "F";

export type ClientRecord = {
  id: string;
  gender: ClientGender | null;
  lastName: string;
  firstName: string;
  /** Jour de naissance 1–31, ou null. */
  birthDay: number | null;
  /** Mois de naissance 1–12, ou null. */
  birthMonth: number | null;
  /** Année de naissance (ex. 1985), ou null. */
  birthYear: number | null;
  address: string;
  phone: string;
  email: string;
  /** Notes / recettes (champs libres multilignes). */
  recettes: string[];
  /** YYYY-MM-DD — première venue (réservations). */
  firstVisitAt: string | null;
  /** YYYY-MM-DD — dernier RDV (réservations). */
  lastVisitAt: string | null;
  /** Client à vérifier (téléphone / appareil / etc.). */
  isSuspect: boolean;
  /** Motifs du signalement. */
  suspectReasons: string[];
  /** Validé manuellement par le salon. */
  validatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientInput = {
  gender?: ClientGender | null;
  lastName?: string;
  firstName?: string;
  birthDay?: number | null;
  birthMonth?: number | null;
  birthYear?: number | null;
  address?: string;
  phone?: string;
  email?: string;
  recettes?: string[];
  firstVisitAt?: string | null;
  lastVisitAt?: string | null;
  isSuspect?: boolean;
  suspectReasons?: string[];
  validatedAt?: string | null;
};

export function formatBirthDate(
  day: number | null,
  month: number | null,
  year?: number | null,
): string {
  const hasDayMonth = Boolean(day && month);
  const hasYear = Boolean(year && year >= 1900);

  if (hasDayMonth && hasYear) {
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }
  if (hasDayMonth) {
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
  }
  if (hasYear) return String(year);
  return "—";
}
