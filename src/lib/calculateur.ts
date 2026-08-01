export type CoupeChoice = "long" | "court" | "homme" | null;
export type VegetaleChoice = 1 | 2 | null;
export type BrushingChoice = "long" | "court" | null;

export type CalculateurSelection = {
  coupe: CoupeChoice;
  couleur: boolean;
  balayage: boolean;
  vegetale: VegetaleChoice;
  keratine: boolean;
  sechage: boolean;
  brushing: BrushingChoice;
};

export const EMPTY_SELECTION: CalculateurSelection = {
  coupe: null,
  couleur: false,
  balayage: false,
  vegetale: null,
  keratine: false,
  sechage: false,
  brushing: null,
};

const MINUTES = {
  coupeLong: 60,
  coupeCourt: 45,
  coupeHomme: 45,
  couleur: 60,
  balayage: 120,
  vegetale1: 120,
  vegetale2: 210,
  keratine: 90,
  sechage: 20,
  brushingLong: 60,
  brushingCourt: 45,
} as const;

export type CalculateurLine = {
  id: string;
  label: string;
  minutes: number;
};

export function applyCalculateurRules(
  prev: CalculateurSelection,
  patch: Partial<CalculateurSelection>,
): CalculateurSelection {
  const selection: CalculateurSelection = { ...prev, ...patch };

  if (selection.vegetale) {
    selection.couleur = false;
    selection.balayage = false;
  }

  // Le dernier choix entre séchage et brushing l’emporte.
  if ("sechage" in patch && patch.sechage) {
    selection.brushing = null;
  } else if ("brushing" in patch && patch.brushing) {
    selection.sechage = false;
  } else if (selection.sechage) {
    selection.brushing = null;
  } else if (selection.brushing) {
    selection.sechage = false;
  }

  return selection;
}

export function getCalculateurFlags(selection: CalculateurSelection) {
  return {
    couleurDisabled: Boolean(selection.vegetale),
    balayageDisabled: Boolean(selection.vegetale),
    sechageDisabled: Boolean(selection.brushing),
    brushingDisabled: Boolean(selection.sechage),
  };
}

export function computeCalculateurLines(
  selection: CalculateurSelection,
): CalculateurLine[] {
  const lines: CalculateurLine[] = [];

  if (selection.coupe === "long") {
    lines.push({ id: "coupe-long", label: "Coupe — long", minutes: MINUTES.coupeLong });
  } else if (selection.coupe === "court") {
    lines.push({
      id: "coupe-court",
      label: "Coupe — court",
      minutes: MINUTES.coupeCourt,
    });
  } else if (selection.coupe === "homme") {
    lines.push({
      id: "coupe-homme",
      label: "Coupe homme",
      minutes: MINUTES.coupeHomme,
    });
  }

  if (selection.couleur) {
    lines.push({ id: "couleur", label: "Couleur", minutes: MINUTES.couleur });
  }

  if (selection.balayage) {
    lines.push({
      id: "balayage",
      label: "Balayage ou mèches",
      minutes: MINUTES.balayage,
    });
  }

  if (selection.vegetale === 1) {
    lines.push({
      id: "vegetale-1",
      label: "Coloration végétale — 1 application",
      minutes: MINUTES.vegetale1,
    });
  } else if (selection.vegetale === 2) {
    lines.push({
      id: "vegetale-2",
      label: "Coloration végétale — 2 applications",
      minutes: MINUTES.vegetale2,
    });
  }

  if (selection.keratine) {
    lines.push({
      id: "keratine",
      label: "Soin kératine",
      minutes: MINUTES.keratine,
    });
  }

  if (selection.sechage) {
    lines.push({ id: "sechage", label: "Séchage", minutes: MINUTES.sechage });
  }

  if (selection.brushing === "long") {
    lines.push({
      id: "brushing-long",
      label: "Brushing — long",
      minutes: MINUTES.brushingLong,
    });
  } else if (selection.brushing === "court") {
    lines.push({
      id: "brushing-court",
      label: "Brushing — court",
      minutes: MINUTES.brushingCourt,
    });
  }

  return lines;
}

export function sumMinutes(lines: CalculateurLine[]): number {
  return lines.reduce((sum, line) => sum + line.minutes, 0);
}

export function formatDurationMinutes(total: number): string {
  if (total <= 0) return "0 min";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return h === 1 ? "1 h" : `${h} h`;
  return `${h} h ${m}`;
}

export function selectionId(selection: CalculateurSelection): string {
  return [
    `coupe=${selection.coupe ?? "0"}`,
    `couleur=${selection.couleur ? 1 : 0}`,
    `balayage=${selection.balayage ? 1 : 0}`,
    `vegetale=${selection.vegetale ?? 0}`,
    `keratine=${selection.keratine ? 1 : 0}`,
    `sechage=${selection.sechage ? 1 : 0}`,
    `brushing=${selection.brushing ?? "0"}`,
  ].join("|");
}

export function selectionLabel(selection: CalculateurSelection): string {
  const lines = computeCalculateurLines(selection);
  if (lines.length === 0) return "—";
  return lines.map((line) => line.label).join(" + ");
}

export type CalculateurCombination = {
  id: string;
  selection: CalculateurSelection;
  label: string;
  minutes: number;
  /** Une seule prestation → pas d’estimation manuelle. */
  isSimple: boolean;
  number: number;
};

/** Toutes les combinaisons valides (exclusions respectées), hors sélection vide. */
export function allValidCombinations(): CalculateurCombination[] {
  const coupes: CoupeChoice[] = [null, "long", "court", "homme"];
  const colorModes: Array<
    Pick<CalculateurSelection, "vegetale" | "couleur" | "balayage">
  > = [
    { vegetale: null, couleur: false, balayage: false },
    { vegetale: null, couleur: true, balayage: false },
    { vegetale: null, couleur: false, balayage: true },
    { vegetale: null, couleur: true, balayage: true },
    { vegetale: 1, couleur: false, balayage: false },
    { vegetale: 2, couleur: false, balayage: false },
  ];
  const keratinas = [false, true];
  const finishes: Array<
    Pick<CalculateurSelection, "sechage" | "brushing">
  > = [
    { sechage: false, brushing: null },
    { sechage: true, brushing: null },
    { sechage: false, brushing: "long" },
    { sechage: false, brushing: "court" },
  ];

  const combinations: Omit<CalculateurCombination, "number">[] = [];

  for (const coupe of coupes) {
    for (const color of colorModes) {
      for (const keratine of keratinas) {
        for (const finish of finishes) {
          const selection: CalculateurSelection = {
            coupe,
            ...color,
            keratine,
            ...finish,
          };
          // Coupe court / homme : pas de soin kératine.
          if (
            keratine &&
            (coupe === "court" || coupe === "homme")
          ) {
            continue;
          }
          // Coupe et brushing ne peuvent pas mélanger court et long.
          if (
            (coupe === "court" && finish.brushing === "long") ||
            (coupe === "long" && finish.brushing === "court")
          ) {
            continue;
          }
          const lines = computeCalculateurLines(selection);
          if (lines.length === 0) continue;
          combinations.push({
            id: selectionId(selection),
            selection,
            label: selectionLabel(selection),
            minutes: sumMinutes(lines),
            isSimple: lines.length === 1,
          });
        }
      }
    }
  }

  return combinations
    .sort((a, b) => {
      if (a.minutes !== b.minutes) return a.minutes - b.minutes;
      return a.label.localeCompare(b.label, "fr");
    })
    .map((combo, index) => ({
      ...combo,
      number: index + 1,
    }));
}

export type BookingGender = "H" | "F";
export type BookingLength = "court" | "long";

export type BookingServiceChoices = {
  coupe: boolean;
  couleur: boolean;
  balayage: boolean;
  vegetale: VegetaleChoice;
  keratine: boolean;
  sechage: boolean;
  brushing: boolean;
};

export const EMPTY_BOOKING_SERVICES: BookingServiceChoices = {
  coupe: false,
  couleur: false,
  balayage: false,
  vegetale: null,
  keratine: false,
  sechage: false,
  brushing: false,
};

/** Construit la sélection calculateur à partir du profil H/F · court/long. */
export function buildBookingSelection(
  gender: BookingGender,
  length: BookingLength,
  services: BookingServiceChoices,
): CalculateurSelection {
  const coupe: CoupeChoice = services.coupe
    ? gender === "H"
      ? "homme"
      : length
    : null;

  let next: CalculateurSelection = {
    coupe,
    couleur: services.couleur,
    balayage: services.balayage,
    vegetale: services.vegetale,
    keratine: services.keratine,
    sechage: services.sechage,
    brushing: services.brushing ? length : null,
  };

  next = applyCalculateurRules(EMPTY_SELECTION, next);

  // Règles métier réservation.
  if (next.keratine && (next.coupe === "court" || next.coupe === "homme")) {
    next = { ...next, keratine: false };
  }
  if (
    (next.coupe === "court" && next.brushing === "long") ||
    (next.coupe === "long" && next.brushing === "court")
  ) {
    next = { ...next, brushing: null };
  }

  return next;
}

export function isKeratineAllowed(
  gender: BookingGender,
  length: BookingLength,
): boolean {
  return gender === "F" && length === "long";
}
