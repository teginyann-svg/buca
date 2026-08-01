"use client";

import {
  Alert,
  App,
  Button,
  Empty,
  Modal,
  Spin,
  Typography,
} from "antd";
import { DeleteOutlined, EyeOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import "dayjs/locale/fr";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GuardsInfoPopover } from "@/components/GuardsInfoPopover";
import { SalonUnlockForm } from "@/components/SalonUnlockForm";
import { ADMIN_HEADER } from "@/lib/admin-constants";
import { formatDurationMinutes } from "@/lib/calculateur";
import { TIMEZONE } from "@/lib/config";
import type { WeekBooking } from "@/lib/booking-types";
import { apiFetch } from "@/lib/api";
import { publicAsset } from "@/lib/public-asset";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("fr");

const STORAGE_KEY = "reservsalon_salon_code";

type WeekHoliday = {
  date: string;
  summary: string;
};

type WeekResponse = {
  weekOffset: number;
  weekStart: string;
  weekEnd: string;
  label: string;
  bookings: WeekBooking[];
  holidays?: WeekHoliday[];
  error?: string;
};

function authHeaders(code: string): HeadersInit {
  return { [ADMIN_HEADER]: code };
}

export default function SemainePage() {
  const { message, modal } = App.useApp();
  const [salonCode, setSalonCode] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<WeekResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<WeekBooking | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) setSalonCode(saved);
  }, []);

  const loadWeek = useCallback(async (code: string, offset: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/week?weekOffset=${offset}`, {
        headers: authHeaders(code),
      });
      const json = (await res.json()) as WeekResponse;
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem(STORAGE_KEY);
          setSalonCode(null);
        }
        throw new Error(json.error ?? "Impossible de charger la semaine.");
      }
      setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (salonCode) {
      void loadWeek(salonCode, weekOffset);
    }
  }, [salonCode, weekOffset, loadWeek]);

  const dayColumns = useMemo(() => {
    if (!data?.weekStart) return [];
    const wednesday = dayjs.tz(data.weekStart, TIMEZONE).add(2, "day");
    const holidayByDate = new Map(
      (data.holidays ?? []).map((h) => [h.date, h.summary]),
    );
    return [0, 1, 2, 3].map((offset) => {
      const day = wednesday.add(offset, "day");
      const dayKey = day.format("YYYY-MM-DD");
      const bookings = (data.bookings ?? [])
        .filter(
          (b) => dayjs(b.start).tz(TIMEZONE).format("YYYY-MM-DD") === dayKey,
        )
        .sort((a, b) => a.start.localeCompare(b.start));
      return {
        dayKey,
        day,
        bookings,
        holidayName: holidayByDate.get(dayKey) ?? null,
      };
    });
  }, [data]);

  const hasAnyBooking = dayColumns.some((col) => col.bookings.length > 0);

  function confirmDelete(booking: WeekBooking) {
          modal.confirm({
            title: "Effacer ce créneau ?",
            content: (
              <span>
                {booking.clientName}
                {booking.clientPhone ? ` · ${booking.clientPhone}` : ""} —{" "}
                {dayjs(booking.start).tz(TIMEZONE).format("dddd D MMM HH:mm")}
                . Ce créneau sera aussi effacé de Google Agenda.
              </span>
            ),
            okText: "Effacer",
            okButtonProps: { danger: true },
            cancelText: "Annuler",
            centered: true,
            width: "min(420px, calc(100vw - 32px))",
            onOk: async () => {
        if (!salonCode) return;
        setDeletingId(booking.id);
        try {
          const res = await apiFetch(`/api/week/${encodeURIComponent(booking.id)}`,
            {
              method: "DELETE",
              headers: authHeaders(salonCode),
            },
          );
          const json = (await res.json()) as { error?: string };
          if (!res.ok) {
            throw new Error(json.error ?? "Suppression impossible.");
          }
          message.success("Créneau effacé.");
          await loadWeek(salonCode, weekOffset);
        } catch (err) {
          message.error(
            err instanceof Error ? err.message : "Suppression impossible.",
          );
        } finally {
          setDeletingId(null);
        }
      },
    });
  }

  if (!salonCode) {
    return (
      <main className="salon-shell">
        <header className="salon-brand">
          <p className="salon-brand__eyebrow">Espace salon</p>
          <h1 className="salon-brand__name">Mes RDVs</h1>
          <p className="salon-brand__tagline">
            Accès à la semaine des réservations
          </p>
        </header>
        <div className="salon-card">
          <div className="salon-card__accent" />
          <div className="salon-card__body">
            <SalonUnlockForm
              submitLabel="Voir la semaine"
              onUnlocked={(code) => {
                sessionStorage.setItem(STORAGE_KEY, code);
                setSalonCode(code);
              }}
              onError={(msg) => message.error(msg)}
            />
          </div>
        </div>
        <p className="salon-footer">
          <Link to="/">← Retour à la réservation</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="salon-shell">
      <header className="salon-brand">
        <p className="salon-brand__eyebrow">Espace salon</p>
        <h1 className="salon-brand__name salon-brand__name--with-info">
          Mes RDVs
          <GuardsInfoPopover />
        </h1>
        <p className="salon-brand__tagline">Client(e)s de la semaine</p>
      </header>

      <div className="salon-card salon-card--wide">
        <div className="salon-card__accent" />
        <div className="salon-card__body">
          <section className="salon-section">
            <div className="salon-week-nav">
              <Button
                icon={<LeftOutlined />}
                onClick={() => setWeekOffset((o) => o - 1)}
                aria-label="Semaine précédente"
              />
              <Typography.Text strong style={{ textAlign: "center", flex: 1 }}>
                {data?.label ?? "…"}
              </Typography.Text>
              <Button
                icon={<RightOutlined />}
                onClick={() => setWeekOffset((o) => o + 1)}
                aria-label="Semaine suivante"
              />
            </div>
            {weekOffset !== 0 && (
              <Button
                type="link"
                onClick={() => setWeekOffset(0)}
                style={{ padding: 0, alignSelf: "center" }}
              >
                Revenir à cette semaine
              </Button>
            )}
          </section>

          <section className="salon-section">
            {loading ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <Spin />
              </div>
            ) : error ? (
              <Alert type="error" showIcon message={error} />
            ) : (
              <>
                {!hasAnyBooking && (
                  <Empty
                    description="Aucun client(e) sur cette semaine."
                    style={{ marginBottom: 16 }}
                  />
                )}
                <div className="salon-week-grid">
                  {dayColumns.map(({ dayKey, day, bookings, holidayName }) => (
                    <div
                      key={dayKey}
                      className={`salon-week-col${holidayName ? " is-holiday" : ""}`}
                    >
                      <div className="salon-week-col__head">
                        <span className="salon-week-col__day">
                          {day
                            .format("ddd")
                            .replace(/^\w/, (c) => c.toUpperCase())}
                        </span>
                        <span className="salon-week-col__date">
                          {day.format("D MMM")}
                        </span>
                        {holidayName ? (
                          <span className="salon-week-col__holiday">
                            {holidayName}
                          </span>
                        ) : null}
                      </div>
                      <div className="salon-week-col__body">
                        {holidayName && bookings.length === 0 ? (
                          <div className="salon-week-col__holiday-art">
                            <img
                              src={publicAsset("jour-ferie.png")}
                              alt="Jour férié"
                              width={120}
                              height={90}
                              className="salon-week-col__holiday-img"
                            />
                            <p className="salon-week-col__empty salon-week-col__empty--holiday">
                              Jour férié
                            </p>
                          </div>
                        ) : bookings.length === 0 ? (
                          <p className="salon-week-col__empty">Libre</p>
                        ) : (
                          bookings.map((booking) => {
                            const start = dayjs(booking.start).tz(TIMEZONE);
                            const end = dayjs(booking.end).tz(TIMEZONE);
                            return (
                              <div
                                key={booking.id}
                                className="salon-booking-card"
                              >
                                <div className="salon-booking-card__time">
                                  {start.format("HH:mm")}–{end.format("HH:mm")}
                                  {booking.durationMinutes != null ? (
                                    <span className="salon-booking-card__duration">
                                      {" "}
                                      ·{" "}
                                      {formatDurationMinutes(
                                        booking.durationMinutes,
                                      )}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="salon-booking-card__name">
                                  {booking.clientName}
                                </div>
                                {(booking.isNewClient ||
                                  booking.sameDevice ||
                                  booking.nonSwissPhone ||
                                  booking.generatedPhone ||
                                  booking.disposableEmail) && (
                                  <div className="salon-booking-card__flags">
                                    {booking.isNewClient ? (
                                      <span className="salon-flag salon-flag--new">
                                        Nouvelle cliente
                                      </span>
                                    ) : null}
                                    {booking.sameDevice ? (
                                      <span className="salon-flag salon-flag--device">
                                        Provient d’un même appareil
                                      </span>
                                    ) : null}
                                    {booking.nonSwissPhone ? (
                                      <span className="salon-flag salon-flag--phone">
                                        N° non-suisse
                                      </span>
                                    ) : null}
                                    {booking.generatedPhone ? (
                                      <span className="salon-flag salon-flag--generated">
                                        N° généré
                                      </span>
                                    ) : null}
                                    {booking.disposableEmail ? (
                                      <span className="salon-flag salon-flag--email">
                                        Email jetable
                                      </span>
                                    ) : null}
                                  </div>
                                )}
                                {booking.clientPhone ? (
                                  <div className="salon-booking-card__phone">
                                    {booking.clientPhone}
                                  </div>
                                ) : null}
                                {booking.servicesLabel ? (
                                  <div className="salon-booking-card__services">
                                    {booking.servicesLabel}
                                  </div>
                                ) : null}
                                <div className="salon-booking-card__actions">
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<EyeOutlined />}
                                    onClick={() => setDetailBooking(booking)}
                                  >
                                    Voir
                                  </Button>
                                  <Button
                                    danger
                                    type="text"
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    loading={deletingId === booking.id}
                                    onClick={() => confirmDelete(booking)}
                                    aria-label={`Effacer ${booking.clientName}`}
                                  >
                                    Effacer
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="salon-section salon-section--actions">
            <div className="salon-admin-footer">
              <nav className="salon-admin-footer__links">
                <Link to="/">Réservation</Link>
                <Link to="/calculateur">Calculateur</Link>
                <Link to="/clients">Fichier clients</Link>
              </nav>
              <Button
                type="link"
                danger
                onClick={() => {
                  sessionStorage.removeItem(STORAGE_KEY);
                  setSalonCode(null);
                  setData(null);
                }}
              >
                Déconnexion
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Modal
        open={Boolean(detailBooking)}
        title={detailBooking?.clientName ?? "Détail RDV"}
        onCancel={() => setDetailBooking(null)}
        footer={
          <Button type="primary" onClick={() => setDetailBooking(null)} block>
            Fermer
          </Button>
        }
        destroyOnHidden
        centered
        className="salon-mobile-modal"
        width="min(480px, calc(100vw - 32px))"
      >
        {detailBooking ? (
          <div className="salon-booking-detail">
            <p>
              <strong>Date</strong>
              <br />
              {dayjs(detailBooking.start)
                .tz(TIMEZONE)
                .format("dddd D MMMM YYYY")}
            </p>
            <p>
              <strong>Horaire</strong>
              <br />
              {dayjs(detailBooking.start).tz(TIMEZONE).format("HH:mm")} –{" "}
              {dayjs(detailBooking.end).tz(TIMEZONE).format("HH:mm")}
              {detailBooking.durationMinutes != null
                ? ` (${formatDurationMinutes(detailBooking.durationMinutes)})`
                : ""}
            </p>
            {detailBooking.clientPhone ? (
              <p>
                <strong>Téléphone</strong>
                <br />
                {detailBooking.clientPhone}
              </p>
            ) : null}
            <p>
              <strong>Services</strong>
              <br />
              {detailBooking.servicesLabel ?? "Non renseignés"}
            </p>
            {(detailBooking.isNewClient ||
              detailBooking.sameDevice ||
              detailBooking.nonSwissPhone ||
              detailBooking.generatedPhone ||
              detailBooking.disposableEmail) && (
              <p>
                <strong>Signalements</strong>
                <br />
                {[
                  detailBooking.isNewClient ? "Nouvelle cliente" : null,
                  detailBooking.sameDevice
                    ? "Provient d’un même appareil"
                    : null,
                  detailBooking.nonSwissPhone ? "N° non-suisse" : null,
                  detailBooking.generatedPhone ? "N° généré" : null,
                  detailBooking.disposableEmail ? "Email jetable" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {detailBooking.email ? (
              <p>
                <strong>Email</strong>
                <br />
                {detailBooking.email}
              </p>
            ) : null}
            {detailBooking.durationMinutes != null ? (
              <p>
                <strong>Temps calculé</strong>
                <br />
                {formatDurationMinutes(detailBooking.durationMinutes)}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
