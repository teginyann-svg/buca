"use client";

import { Alert, App, Button, Checkbox, DatePicker, Form, Input, Space, Spin } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/fr";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isBookableDate, type TimeSlot } from "@/lib/availability";
import {
  buildBookingSelection,
  computeCalculateurLines,
  EMPTY_BOOKING_SERVICES,
  isKeratineAllowed,
  type BookingGender,
  type BookingLength,
  type BookingServiceChoices,
  type CalculateurSelection,
} from "@/lib/calculateur";
import { SALON_NAME, TIMEZONE } from "@/lib/config";
import { apiFetch } from "@/lib/api";
import { publicAsset } from "@/lib/public-asset";
import {
  assertValidSwissPhone,
  SALON_CALL_PHONE_DISPLAY,
  SALON_CALL_PHONE_TEL,
} from "@/lib/swiss-phone";
import LocalReservationLink from "@local/reservation-link";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("fr");

const DEVICE_STORAGE_KEY = "reservsalon_device_id";
const CONTACT_STORAGE_KEY = "reservsalon_contact";

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
    return id;
  } catch {
    return `anon-${Date.now()}`;
  }
}

type StoredContact = {
  clientPhone: string;
  clientFirstName: string;
  clientLastName?: string;
  clientEmail?: string;
};

function readStoredContact(): StoredContact | null {
  try {
    const raw = localStorage.getItem(CONTACT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredContact>;
    if (typeof parsed.clientPhone !== "string" || !parsed.clientPhone.trim()) {
      return null;
    }
    return {
      clientPhone: parsed.clientPhone.trim(),
      clientFirstName:
        typeof parsed.clientFirstName === "string"
          ? parsed.clientFirstName
          : "",
      clientLastName:
        typeof parsed.clientLastName === "string"
          ? parsed.clientLastName
          : "",
      clientEmail:
        typeof parsed.clientEmail === "string" ? parsed.clientEmail : "",
    };
  } catch {
    return null;
  }
}

function writeStoredContact(contact: StoredContact): void {
  try {
    localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(contact));
  } catch {
    /* private mode / quota */
  }
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

type SlotHourRow = {
  hour: number;
  hourLabel: string;
  /** Quarts :00 / :15 / :30 / :45 — null = indisponible. */
  quarters: ({ minute: number; label: string; slot: TimeSlot } | null)[];
};

const QUARTER_MINUTES = [0, 15, 30, 45] as const;

/** Groupe les créneaux : une ligne = heure pleine + ses 4 quarts. */
function groupSlotsByHour(slots: TimeSlot[]): SlotHourRow[] {
  const byHour = new Map<number, Map<number, TimeSlot>>();

  for (const slot of slots) {
    const local = dayjs(slot.start).tz(TIMEZONE);
    const hour = local.hour();
    const minute = local.minute();
    let minutes = byHour.get(hour);
    if (!minutes) {
      minutes = new Map();
      byHour.set(hour, minutes);
    }
    minutes.set(minute, slot);
  }

  return Array.from(byHour.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, minutes]) => ({
      hour,
      hourLabel: `${String(hour).padStart(2, "0")}h`,
      quarters: QUARTER_MINUTES.map((minute) => {
        const slot = minutes.get(minute);
        if (!slot) return null;
        return {
          minute,
          label: `:${String(minute).padStart(2, "0")}`,
          slot,
        };
      }),
    }));
}

type BookingFormValues = {
  clientFirstName: string;
  clientLastName?: string;
  clientPhone: string;
  clientEmail?: string;
};

type Quote = {
  minutes: number;
  calculatedMinutes: number;
  estimatedMinutes: number | null;
  label: string;
};

type BookResponse = {
  ok?: boolean;
  error?: string;
  needsConfirmation?: boolean;
  code?: string;
  start?: string;
  end?: string;
  firstName?: string;
  servicesLabel?: string;
  clientRecorded?: boolean;
  clientRecordError?: string | null;
};

function BrandHeader({ tagline }: { tagline?: string }) {
  return (
    <header className="salon-brand">
      <div className="salon-brand__avatar">
        <img
          src={publicAsset("danijela.png")}
          alt="Danijela"
          width={112}
          height={112}
          className="salon-brand__avatar-img"
        />
      </div>
      <p className="salon-brand__eyebrow">Coiffure</p>
      <h1 className="salon-brand__name">{SALON_NAME}</h1>
      {tagline ? <p className="salon-brand__tagline">{tagline}</p> : null}
      <LocalReservationLink />
    </header>
  );
}

function patchServices(
  prev: BookingServiceChoices,
  patch: Partial<BookingServiceChoices>,
): BookingServiceChoices {
  const next = { ...prev, ...patch };

  if (next.vegetale) {
    next.couleur = false;
    next.balayage = false;
  }

  if ("sechage" in patch && patch.sechage) {
    next.brushing = false;
  } else if ("brushing" in patch && patch.brushing) {
    next.sechage = false;
  } else if (next.sechage && next.brushing) {
    next.brushing = false;
  }

  return next;
}

export default function HomePage() {
  const { message, modal } = App.useApp();
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<BookingGender | null>(null);
  const [length, setLength] = useState<BookingLength | null>(null);
  const [services, setServices] = useState<BookingServiceChoices>(
    EMPTY_BOOKING_SERVICES,
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    start: string;
    end: string;
    firstName: string;
    servicesLabel: string;
  } | null>(null);
  const [form] = Form.useForm<BookingFormValues>();
  const watchedPhone = Form.useWatch("clientPhone", form);
  const [contactPrefillHint, setContactPrefillHint] = useState<string | null>(
    null,
  );

  const selection: CalculateurSelection | null = useMemo(() => {
    if (!gender || !length) return null;
    return buildBookingSelection(gender, length, services);
  }, [gender, length, services]);

  const previewLines = useMemo(
    () => (selection ? computeCalculateurLines(selection) : []),
    [selection],
  );
  const slotHourRows = useMemo(() => groupSlotsByHour(slots), [slots]);
  const keratineOk = gender && length ? isKeratineAllowed(gender, length) : false;
  /** Homme → immédiatement indisponible ; femme court aussi ; seul F+long OK. */
  const keratineDisabled =
    gender === "H" || length === "court" || (Boolean(gender && length) && !keratineOk);

  const loadQuote = useCallback(async (sel: CalculateurSelection) => {
    setQuoteLoading(true);
    try {
      const res = await apiFetch("/api/booking/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: sel }),
      });
      const data = (await res.json()) as Quote & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Durée impossible.");
      setQuote({
        minutes: data.minutes,
        calculatedMinutes: data.calculatedMinutes,
        estimatedMinutes: data.estimatedMinutes,
        label: data.label,
      });
      return data;
    } catch (err) {
      setQuote(null);
      message.error(err instanceof Error ? err.message : "Durée impossible.");
      return null;
    } finally {
      setQuoteLoading(false);
    }
  }, [message]);

  const loadSlots = useCallback(
    async (date: Dayjs, duration: number) => {
      setSlotsLoading(true);
      setSlotsError(null);
      setSlots([]);
      setSelectedSlot(null);

      try {
        const dateKey = date.tz(TIMEZONE).format("YYYY-MM-DD");
        const res = await apiFetch(`/api/slots?date=${dateKey}&duration=${duration}`,
        );
        const data = (await res.json()) as {
          slots?: TimeSlot[];
          error?: string;
          holiday?: boolean;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Impossible de charger les créneaux.");
        }
        if (data.holiday) {
          setSlotsError(data.error ?? "Jour férié — salon fermé.");
          setSlots([]);
          return;
        }
        setSlots(data.slots ?? []);
      } catch (err) {
        setSlotsError(
          err instanceof Error ? err.message : "Erreur de chargement.",
        );
      } finally {
        setSlotsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (step === 1 && selectedDate && quote) {
      void loadSlots(selectedDate, quote.minutes);
    }
  }, [step, selectedDate, quote, loadSlots]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/holidays");
        const data = (await res.json()) as {
          dates?: string[];
          error?: string;
        };
        if (!res.ok || cancelled) return;
        setHolidayDates(new Set(data.dates ?? []));
      } catch {
        // DatePicker reste utilisable sans jours fériés si l’API échoue.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Étape 3 : reprendre les coordonnées du dernier RDV (même appareil).
  useEffect(() => {
    if (step !== 2) return;
    const stored = readStoredContact();
    if (!stored) return;
    const current = form.getFieldsValue();
    form.setFieldsValue({
      clientPhone: current.clientPhone?.trim()
        ? current.clientPhone
        : stored.clientPhone,
      clientFirstName: current.clientFirstName?.trim()
        ? current.clientFirstName
        : stored.clientFirstName,
      clientLastName: current.clientLastName?.trim()
        ? current.clientLastName
        : stored.clientLastName,
      clientEmail: current.clientEmail?.trim()
        ? current.clientEmail
        : stored.clientEmail,
    });
    if (!current.clientFirstName?.trim() && stored.clientFirstName) {
      setContactPrefillHint("Coordonnées reprises de votre dernier RDV.");
    }
  }, [step, form]);

  // Étape 3 : si le n° est dans le fichier clients → remplir le reste.
  useEffect(() => {
    if (step !== 2) return;
    const phone = typeof watchedPhone === "string" ? watchedPhone.trim() : "";
    if (phoneDigits(phone).length < 8) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await apiFetch("/api/clients/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
          });
          const data = (await res.json()) as {
            found?: boolean;
            firstName?: string;
            lastName?: string;
            email?: string;
          };
          if (!res.ok || !data.found) return;

          form.setFieldsValue({
            clientFirstName: data.firstName?.trim() || undefined,
            clientLastName: data.lastName?.trim() || undefined,
            clientEmail: data.email?.trim() || undefined,
          });
          const name = data.firstName?.trim();
          setContactPrefillHint(
            name
              ? `Bienvenue ${name} — infos reprises du fichier clients.`
              : "Infos reprises du fichier clients.",
          );
        } catch {
          /* lookup optionnel */
        }
      })();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [step, watchedPhone, form]);

  async function goToSlots() {
    if (!gender) {
      message.warning("Choisissez Femme ou Homme.");
      return;
    }
    if (!length) {
      message.warning("Choisissez la longueur de cheveux (court ou long).");
      return;
    }
    const hasService =
      services.coupe ||
      services.couleur ||
      services.balayage ||
      services.vegetale ||
      services.keratine ||
      services.sechage ||
      services.brushing;
    if (!hasService) {
      message.warning("Choisissez au moins un service.");
      return;
    }
    if (services.keratine && !keratineOk) {
      message.warning(
        "Le soin kératine est réservé aux femmes aux cheveux longs.",
      );
      return;
    }
    if (!selection || previewLines.length === 0) {
      message.warning("Sélection invalide — vérifiez profil et services.");
      return;
    }
    const q = await loadQuote(selection);
    if (!q) return;
    setSelectedDate(null);
    setSelectedSlot(null);
    setSlots([]);
    setStep(1);
  }

  function goToContact() {
    if (!selectedSlot) {
      message.warning("Choisissez un créneau.");
      return;
    }
    setStep(2);
  }

  async function onFinish(values: BookingFormValues) {
    if (!selectedSlot || !selection) {
      message.warning("Choisissez un créneau.");
      return;
    }

    async function postBook(confirmDeviceCeiling: boolean) {
      const res = await apiFetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: selectedSlot!.start,
          clientFirstName: values.clientFirstName,
          clientLastName: values.clientLastName ?? "",
          clientPhone: values.clientPhone,
          clientEmail: values.clientEmail ?? "",
          deviceId: getOrCreateDeviceId(),
          confirmDeviceCeiling,
          selection,
        }),
      });
      const data = (await res.json()) as BookResponse;
      return { res, data };
    }

    setSubmitting(true);
    try {
      let { res, data } = await postBook(false);

      if (
        !res.ok &&
        res.status === 409 &&
        data.needsConfirmation &&
        data.error
      ) {
        setSubmitting(false);
        const confirmedCeiling = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: "Confirmer la réservation",
            content: data.error,
            okText: "Oui, confirmer",
            cancelText: "Annuler",
            centered: true,
            maskClosable: true,
            keyboard: true,
            width: "min(400px, calc(100vw - 32px))",
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirmedCeiling) {
          // Aucun RDV créé côté serveur : le créneau reste disponible.
          message.info(
            "Réservation non confirmée — votre créneau reste disponible.",
          );
          return;
        }
        setSubmitting(true);
        ({ res, data } = await postBook(true));
      }

      if (!res.ok) {
        const errMsg = data.error ?? "La réservation a échoué.";
        if (res.status === 429) {
          message.warning(errMsg);
        } else {
          message.error(errMsg);
        }
        if (selectedDate && quote) void loadSlots(selectedDate, quote.minutes);
        return;
      }
      if (data.clientRecorded === false) {
        message.warning(
          data.clientRecordError
            ? `RDV enregistré dans l’agenda, mais fiche client non mise à jour : ${data.clientRecordError}`
            : "RDV enregistré dans l’agenda, mais fiche client non mise à jour (fichier clients).",
        );
      }
      setConfirmed({
        start: data.start ?? selectedSlot.start,
        end: data.end ?? selectedSlot.end,
        firstName: data.firstName ?? values.clientFirstName,
        servicesLabel: data.servicesLabel ?? quote?.label ?? "",
      });
      writeStoredContact({
        clientPhone: values.clientPhone,
        clientFirstName: values.clientFirstName,
        clientLastName: values.clientLastName ?? "",
        clientEmail: values.clientEmail ?? "",
      });
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "La réservation a échoué.",
      );
      if (selectedDate && quote) void loadSlots(selectedDate, quote.minutes);
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    setConfirmed(null);
    setStep(0);
    setGender(null);
    setLength(null);
    setServices(EMPTY_BOOKING_SERVICES);
    setQuote(null);
    setSelectedSlot(null);
    setSelectedDate(null);
    setSlots([]);
    setContactPrefillHint(null);
    form.resetFields();
  }

  if (confirmed) {
    const start = dayjs(confirmed.start).tz(TIMEZONE);
    const whenLabel = `${start.format("dddd D MMMM YYYY")} à ${start.format("HH:mm")}`;
    const servicesBit = confirmed.servicesLabel
      ? ` (${confirmed.servicesLabel})`
      : "";
    const waSalonDigits = SALON_CALL_PHONE_TEL.replace(/\D/g, "");
    const waReminderText = encodeURIComponent(
      `Rappel RDV Red Room Coiffure — ${whenLabel}${servicesBit}`,
    );
    const waCancelText = encodeURIComponent(
      `Bonjour Danijela, je souhaite annuler ou modifier mon RDV du ${whenLabel}. Merci !`,
    );

    return (
      <main className="salon-shell">
        <BrandHeader />
        <div className="salon-card">
          <div className="salon-card__accent" />
          <div className="salon-card__body">
            <div className="salon-success">
              <div className="salon-success__mark" aria-hidden>
                ✓
              </div>
              <h2>Merci {confirmed.firstName},</h2>
              <p>
                j’ai bien noté le RDV dans mon agenda.
              </p>
              <p className="salon-success__when">
                {start.format("dddd D MMMM YYYY")}
                <br />
                {start.format("HH:mm")}
              </p>
              {confirmed.servicesLabel ? (
                <p className="salon-success__services">
                  {confirmed.servicesLabel}
                </p>
              ) : null}
              <p className="salon-success__sign">Danijela</p>

              <div className="salon-section">
                <Button
                  size="large"
                  block
                  href={`https://wa.me/?text=${waReminderText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Me l’envoyer en rappel (WhatsApp)
                </Button>
                <p className="wizard-hint" style={{ marginTop: 12 }}>
                  Pour annuler ou modifier :{" "}
                  <a
                    href={`https://wa.me/${waSalonDigits}?text=${waCancelText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>{" "}
                  ou{" "}
                  <a href={`tel:${SALON_CALL_PHONE_TEL}`}>
                    {SALON_CALL_PHONE_DISPLAY}
                  </a>
                  .
                </p>
              </div>

              <div className="salon-section salon-section--actions">
                <Button type="default" size="large" block onClick={resetWizard}>
                  Nouvelle réservation
                </Button>
              </div>
            </div>
          </div>
        </div>
        <p className="salon-footer">
          <Link to="/cg" className="salon-footer__link">
            Conditions &amp; confidentialité
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="salon-shell">
      <BrandHeader tagline="Réservez en 3 étapes — durée selon vos services." />

      <div className="salon-card">
        <div className="salon-card__accent" />
        <div className="salon-card__body">
          <div className="salon-steps" aria-label={`Étape ${step + 1} sur 3`}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`salon-step${step >= i ? " is-active" : ""}${step > i ? " is-done" : ""}`}
              />
            ))}
          </div>

          {step === 0 && (
            <section className="salon-section">
              <span className="salon-label">Étape 1 — Profil & services</span>

              <div className="wizard-group">
                <p className="wizard-group__title">Vous êtes un(e)</p>
                <div
                  className="wizard-choice-row"
                  role="radiogroup"
                  aria-label="Sexe"
                >
                  <button
                    type="button"
                    className={`wizard-choice${gender === "F" ? " is-selected" : ""}`}
                    aria-pressed={gender === "F"}
                    onClick={() => setGender("F")}
                  >
                    <img
                      src={publicAsset("gender-f.png")}
                      alt=""
                      width={48}
                      height={48}
                      className="wizard-gender-icon"
                    />
                    <span className="wizard-choice__label">Femme</span>
                  </button>
                  <button
                    type="button"
                    className={`wizard-choice${gender === "H" ? " is-selected" : ""}`}
                    aria-pressed={gender === "H"}
                    onClick={() => {
                      setGender("H");
                      setServices((prev) =>
                        patchServices(prev, { keratine: false }),
                      );
                    }}
                  >
                    <img
                      src={publicAsset("gender-h.png")}
                      alt=""
                      width={48}
                      height={48}
                      className="wizard-gender-icon"
                    />
                    <span className="wizard-choice__label">Homme</span>
                  </button>
                </div>
                {gender ? (
                  <p className="wizard-gender-confirm" role="status">
                    Profil sélectionné :{" "}
                    <strong>{gender === "F" ? "Femme" : "Homme"}</strong>
                  </p>
                ) : (
                  <p className="wizard-group__note">
                    Choisissez Femme ou Homme.
                  </p>
                )}
              </div>

              <div className="wizard-group">
                <p className="wizard-group__title">Longueur de cheveux</p>
                <div
                  className="wizard-choice-row"
                  role="radiogroup"
                  aria-label="Longueur de cheveux"
                >
                  <button
                    type="button"
                    className={`wizard-choice wizard-choice--text${length === "court" ? " is-selected" : ""}`}
                    aria-pressed={length === "court"}
                    onClick={() => {
                      setLength("court");
                      setServices((prev) =>
                        patchServices(prev, { keratine: false }),
                      );
                    }}
                  >
                    Court
                  </button>
                  <button
                    type="button"
                    className={`wizard-choice wizard-choice--text${length === "long" ? " is-selected" : ""}`}
                    aria-pressed={length === "long"}
                    onClick={() => setLength("long")}
                  >
                    Long
                  </button>
                </div>
                {length ? (
                  <p className="wizard-gender-confirm" role="status">
                    Longueur : <strong>{length === "court" ? "Court" : "Long"}</strong>
                  </p>
                ) : null}
              </div>

              <div className="wizard-group">
                <p className="wizard-group__title">Services</p>
                <p className="wizard-group__note">
                  Cochez tout ce dont vous avez besoin. Séchage et brushing
                  s’excluent mutuellement.
                </p>
                <div className="wizard-services">
                  <label className="wizard-check">
                    <Checkbox
                      checked={services.coupe}
                      onChange={(e) =>
                        setServices((prev) =>
                          patchServices(prev, { coupe: e.target.checked }),
                        )
                      }
                    />
                    <span>
                      Coupe
                      {gender === "H"
                        ? " homme"
                        : length === "long"
                          ? " — long"
                          : length === "court"
                            ? " — court"
                            : ""}
                    </span>
                  </label>

                  <label className="wizard-check">
                    <Checkbox
                      checked={services.couleur}
                      disabled={Boolean(services.vegetale)}
                      onChange={(e) =>
                        setServices((prev) =>
                          patchServices(prev, { couleur: e.target.checked }),
                        )
                      }
                    />
                    <span>Couleur</span>
                  </label>

                  <label className="wizard-check">
                    <Checkbox
                      checked={services.balayage}
                      disabled={Boolean(services.vegetale)}
                      onChange={(e) =>
                        setServices((prev) =>
                          patchServices(prev, { balayage: e.target.checked }),
                        )
                      }
                    />
                    <span>Balayage ou mèches</span>
                  </label>

                  {/* Coloration végétale : masquée côté réservation client pour l’instant
                      (toujours disponible dans le calculateur admin). */}

                  <label
                    className={`wizard-check${keratineDisabled ? " is-disabled" : ""}`}
                  >
                    <Checkbox
                      checked={services.keratine}
                      disabled={keratineDisabled}
                      onChange={(e) =>
                        setServices((prev) =>
                          patchServices(prev, { keratine: e.target.checked }),
                        )
                      }
                    />
                    <span>
                      Soin kératine
                      {gender === "H"
                        ? " — non disponible pour les hommes"
                        : length === "court"
                          ? " — cheveux longs uniquement"
                          : gender && length && !keratineOk
                            ? " — femme, cheveux longs uniquement"
                            : ""}
                    </span>
                  </label>

                  <label className="wizard-check">
                    <Checkbox
                      checked={services.sechage}
                      disabled={services.brushing}
                      onChange={(e) =>
                        setServices((prev) =>
                          patchServices(prev, { sechage: e.target.checked }),
                        )
                      }
                    />
                    <span>Séchage</span>
                  </label>

                  <label className="wizard-check">
                    <Checkbox
                      checked={services.brushing}
                      disabled={services.sechage}
                      onChange={(e) =>
                        setServices((prev) =>
                          patchServices(prev, { brushing: e.target.checked }),
                        )
                      }
                    />
                    <span>
                      Brushing
                      {length ? ` — ${length}` : ""}
                    </span>
                  </label>
                </div>
              </div>

              {previewLines.length > 0 ? (
                <div className="wizard-summary">
                  <p className="wizard-summary__label">Sélection</p>
                  <ul>
                    {previewLines.map((line) => (
                      <li key={line.id}>{line.label}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="salon-empty">
                  {!gender || !length
                    ? "Choisissez d’abord si vous êtes un homme ou une femme, puis la longueur de cheveux."
                    : "Cochez au moins un service ci-dessus."}
                </p>
              )}

              <div className="salon-section salon-section--actions">
                <Button
                  type="primary"
                  size="large"
                  block
                  loading={quoteLoading}
                  onClick={() => void goToSlots()}
                >
                  Continuer
                </Button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="salon-section">
              <span className="salon-label">Étape 2 — Créneau</span>
              {quote ? (
                <p className="wizard-hint">{quote.label}</p>
              ) : null}

              <span className="salon-label">Date</span>
              <DatePicker
                size="large"
                style={{ width: "100%" }}
                format="dddd D MMMM YYYY"
                placeholder="Choisir une date"
                disabledDate={(current) =>
                  !current ||
                  !isBookableDate(current.tz(TIMEZONE), dayjs(), holidayDates)
                }
                value={selectedDate}
                onChange={(value) => setSelectedDate(value)}
              />

              {selectedDate && (
                <>
                  <span className="salon-label">Heures libres</span>
                  {slotsLoading ? (
                    <div style={{ padding: "20px 0", textAlign: "center" }}>
                      <Spin />
                    </div>
                  ) : slotsError ? (
                    <Alert type="error" showIcon message={slotsError} />
                  ) : slots.length === 0 ? (
                    <p className="salon-empty">
                      Aucun créneau disponible pour cette durée.
                      <br />
                      Merci d’appeler le{" "}
                      <a href={`tel:${SALON_CALL_PHONE_TEL}`}>
                        {SALON_CALL_PHONE_DISPLAY}
                      </a>{" "}
                      ou d’envoyer un message WhatsApp au{" "}
                      <a
                        href={`https://wa.me/${SALON_CALL_PHONE_TEL.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {SALON_CALL_PHONE_DISPLAY}
                      </a>
                      .
                    </p>
                  ) : (
                    <div className="salon-slot-rows" role="list">
                      {slotHourRows.map((row) => (
                        <div
                          key={row.hour}
                          className="salon-slot-row"
                          role="listitem"
                        >
                          <span className="salon-slot-hour" aria-hidden>
                            {row.hourLabel}
                          </span>
                          <div
                            className="salon-slot-quarters"
                            role="group"
                            aria-label={`Créneaux ${row.hourLabel}`}
                          >
                            {row.quarters.map((q, index) => {
                              const minute = QUARTER_MINUTES[index];
                              const label = `:${String(minute).padStart(2, "0")}`;
                              if (!q) {
                                return (
                                  <button
                                    key={`${row.hour}-${minute}`}
                                    type="button"
                                    className="salon-slot"
                                    disabled
                                    aria-label={`${row.hourLabel}${label} indisponible`}
                                  >
                                    {label}
                                  </button>
                                );
                              }
                              return (
                                <button
                                  key={q.slot.start}
                                  type="button"
                                  className={`salon-slot${
                                    selectedSlot?.start === q.slot.start
                                      ? " is-selected"
                                      : ""
                                  }`}
                                  aria-label={`${row.hourLabel}${q.label}`}
                                  onClick={() => setSelectedSlot(q.slot)}
                                >
                                  {q.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="salon-section salon-section--actions">
                <Space style={{ width: "100%" }} direction="vertical" size={10}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    disabled={!selectedSlot}
                    onClick={goToContact}
                  >
                    Continuer
                  </Button>
                  <Button size="large" block onClick={() => setStep(0)}>
                    Retour
                  </Button>
                </Space>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="salon-section">
              <span className="salon-label">Étape 3 — Vos coordonnées</span>
              {selectedSlot ? (
                <p className="wizard-hint">
                  {dayjs(selectedSlot.start)
                    .tz(TIMEZONE)
                    .format("dddd D MMMM YYYY · HH:mm")}
                </p>
              ) : null}

              <Form
                form={form}
                layout="vertical"
                requiredMark={false}
                onFinish={onFinish}
                style={{ marginTop: 4 }}
              >
                <Form.Item
                  name="clientPhone"
                  label="Téléphone"
                  rules={[
                    {
                      required: true,
                      message: "Indiquez votre numéro de téléphone.",
                    },
                    {
                      validator: async (_, value) => {
                        const raw = typeof value === "string" ? value : "";
                        if (!raw.trim()) return;
                        const err = assertValidSwissPhone(raw);
                        if (err) throw new Error(err);
                      },
                    },
                  ]}
                  extra="Tous les pays acceptés. Un numéro généré sera signalé (pas refusé)."
                >
                  <Input
                    placeholder="079 123 45 67"
                    size="large"
                    autoComplete="tel"
                    inputMode="tel"
                    autoFocus
                  />
                </Form.Item>

                {contactPrefillHint ? (
                  <p className="wizard-hint" role="status">
                    {contactPrefillHint}
                  </p>
                ) : null}

                <Form.Item
                  name="clientFirstName"
                  label="Prénom"
                  rules={[
                    { required: true, message: "Indiquez votre prénom." },
                  ]}
                >
                  <Input
                    placeholder="Prénom"
                    size="large"
                    autoComplete="given-name"
                  />
                </Form.Item>
                <Form.Item name="clientLastName" label="Nom">
                  <Input
                    placeholder="Nom (optionnel)"
                    size="large"
                    autoComplete="family-name"
                  />
                </Form.Item>
                <Form.Item
                  name="clientEmail"
                  label="Email"
                  rules={[
                    {
                      validator: async (_, value) => {
                        const raw = typeof value === "string" ? value : "";
                        if (!raw.trim()) return;
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) {
                          throw new Error("Adresse e-mail invalide.");
                        }
                      },
                    },
                  ]}
                  extra="Une adresse jetable sera signalée (pas refusée)."
                >
                  <Input
                    placeholder="email@exemple.com"
                    size="large"
                    autoComplete="email"
                    type="email"
                  />
                </Form.Item>

                <div className="salon-section salon-section--actions">
                  <Space
                    style={{ width: "100%" }}
                    direction="vertical"
                    size={10}
                  >
                    <Button
                      type="primary"
                      htmlType="submit"
                      size="large"
                      block
                      loading={submitting}
                    >
                      Confirmer le rendez-vous
                    </Button>
                    <Button size="large" block onClick={() => setStep(1)}>
                      Retour
                    </Button>
                  </Space>
                </div>
              </Form>
            </section>
          )}
        </div>
      </div>

      <p className="salon-footer">
        Ouvert mer–ven 9h–19h · sam 9h–17h · Suisse
        <br />
        <Link to="/cg" className="salon-footer__link">
          Conditions &amp; confidentialité
        </Link>
        {" · "}
        <Link to="/semaine" className="salon-footer__link">
          Espace salon
        </Link>
      </p>
    </main>
  );
}
