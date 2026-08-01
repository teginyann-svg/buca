export type PhoneCheckResult = {
  /** Numéro utilisable (format plausible, non généré). Les non-suisses sont OK. */
  ok: boolean;
  digits: string;
  isSwiss: boolean;
  looksGenerated: boolean;
  errors: string[];
};

/** Préfixes nationaux suisses (après le 0) — mobiles + fixes courants. */
const SWISS_PREFIXES = [
  "74",
  "75",
  "76",
  "77",
  "78",
  "79",
  "21",
  "22",
  "24",
  "26",
  "27",
  "31",
  "32",
  "33",
  "34",
  "41",
  "43",
  "44",
  "51",
  "52",
  "55",
  "56",
  "61",
  "62",
  "71",
  "81",
  "91",
] as const;

const KNOWN_FAKE_NATIONAL = new Set([
  "0791234567",
  "0790000000",
  "0780000000",
  "0770000000",
  "0760000000",
  "0750000000",
  "0123456789",
  "0000000000",
  "1111111111",
  "9999999999",
  "0900000000",
  "0800000000",
]);

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Normalise vers format national 0XXXXXXXXX si possible (numéro CH). */
export function normalizeToSwissNational(raw: string): string | null {
  let digits = onlyDigits(raw);
  if (digits.startsWith("0041")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("41") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.length === 10 && digits.startsWith("0")) return digits;
  if (digits.length === 9 && !digits.startsWith("0")) return `0${digits}`;
  return null;
}

/**
 * Clé de comparaison téléphone : espaces / +41 / 079 → même identité CH.
 * Hors CH : chiffres seuls (sans 00 initial).
 */
export function phoneMatchKey(raw: string): string {
  const national = normalizeToSwissNational(raw);
  if (national) return national;
  let digits = onlyDigits(raw.trim());
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

function hasLongRun(digits: string, min = 6): boolean {
  let run = 1;
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] === digits[i - 1]) {
      run += 1;
      if (run >= min) return true;
    } else {
      run = 1;
    }
  }
  return false;
}

function hasSequentialRun(digits: string, min = 6): boolean {
  let asc = 1;
  let desc = 1;
  for (let i = 1; i < digits.length; i++) {
    const a = Number(digits[i - 1]);
    const b = Number(digits[i]);
    if (b === (a + 1) % 10) {
      asc += 1;
      desc = 1;
    } else if (b === (a + 9) % 10) {
      desc += 1;
      asc = 1;
    } else {
      asc = 1;
      desc = 1;
    }
    if (asc >= min || desc >= min) return true;
  }
  return false;
}

function hasRepeatingPattern(digits: string): boolean {
  for (const size of [2, 3, 4]) {
    if (digits.length < size * 3) continue;
    const unit = digits.slice(0, size);
    if (unit.split("").every((c) => c === unit[0])) continue;
    if (
      digits ===
      unit.repeat(Math.ceil(digits.length / size)).slice(0, digits.length)
    ) {
      return true;
    }
  }
  return false;
}

function looksLikeGeneratedDigits(digits: string): boolean {
  if (!digits) return false;
  if (KNOWN_FAKE_NATIONAL.has(digits)) return true;

  const national = digits.length === 10 && digits.startsWith("0") ? digits : null;
  if (national && KNOWN_FAKE_NATIONAL.has(national)) return true;

  const isSwissNationalShape = Boolean(national);
  const body =
    digits.startsWith("0") && digits.length >= 9 ? digits.slice(1) : digits;

  if (body.length < 6) return false;
  if (hasLongRun(body, 6)) return true;
  if (hasRepeatingPattern(body)) return true;

  if (isSwissNationalShape) {
    if (hasSequentialRun(body, 7)) return true;
    if ((body.match(/0/g) ?? []).length >= 5) return true;
    if ((body.match(/1/g) ?? []).length >= 6) return true;
  } else {
    // International : uniquement motifs très flagrants (évite les faux positifs).
    if (hasSequentialRun(body, 9)) return true;
    if ((body.match(/0/g) ?? []).length >= 7) return true;
    if ((body.match(/1/g) ?? []).length >= 8) return true;
  }
  return false;
}

function hasSwissPrefix(national: string): boolean {
  const rest = national.slice(1);
  return SWISS_PREFIXES.some((p) => rest.startsWith(p));
}

/**
 * Accepte les numéros internationaux plausibles.
 * Format invalide → ok:false. N° généré → ok:true + looksGenerated (signalement, pas de refus).
 */
export function checkSwissPhone(raw: string): PhoneCheckResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      digits: "",
      isSwiss: false,
      looksGenerated: false,
      errors: ["Indiquez un numéro de téléphone."],
    };
  }

  let digits = onlyDigits(trimmed);
  if (digits.startsWith("00")) digits = digits.slice(2);

  const national = normalizeToSwissNational(trimmed);
  const isSwiss = Boolean(national && hasSwissPrefix(national));
  const normalizedDigits = national ?? digits;

  if (normalizedDigits.length < 8 || normalizedDigits.length > 15) {
    return {
      ok: false,
      digits: normalizedDigits,
      isSwiss: false,
      looksGenerated: false,
      errors: [
        "Numéro invalide. Indiquez un numéro complet (ex. 079 123 45 67 ou +33…).",
      ],
    };
  }

  const looksGenerated = looksLikeGeneratedDigits(
    national ?? normalizedDigits,
  );

  return {
    ok: true,
    digits: normalizedDigits,
    isSwiss,
    looksGenerated,
    errors: looksGenerated
      ? ["N° généré (motif factice / générateur)."]
      : [],
  };
}

/** Erreur bloquante : vide ou format invalide uniquement (pas les générés). */
export function assertValidSwissPhone(raw: string): string | null {
  const result = checkSwissPhone(raw);
  if (result.ok) return null;
  return result.errors[0] ?? "Numéro de téléphone invalide.";
}

export const SALON_CALL_PHONE_DISPLAY = "079 708 76 87";
export const SALON_CALL_PHONE_TEL = "+41797087687";
