"use client";

import { App, Button, Input, InputNumber, Space, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_HEADER } from "@/lib/admin-constants";
import {
  allValidCombinations,
  formatDurationMinutes,
  type CalculateurCombination,
} from "@/lib/calculateur";
import { SalonUnlockForm } from "@/components/SalonUnlockForm";
import { apiFetch } from "@/lib/api";

const STORAGE_KEY = "reservsalon_salon_code";

type Row = CalculateurCombination & {
  draftMinutes: number | null;
  savedMinutes: number | null;
};

export default function CalculateurPage() {
  const { message } = App.useApp();
  const [salonCode, setSalonCode] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<Record<string, number>>({});
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, number | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [loadingEstimates, setLoadingEstimates] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const combinations = useMemo(() => allValidCombinations(), []);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) setSalonCode(saved);
  }, []);

  const loadEstimates = useCallback(
    async (code: string) => {
      setLoadingEstimates(true);
      try {
        const res = await apiFetch("/api/calculateur/estimates", {
          headers: { [ADMIN_HEADER]: code },
        });
        const json = (await res.json()) as {
          estimates?: Record<string, number>;
          hidden?: string[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? "Chargement impossible.");
        }
        setEstimates(json.estimates ?? {});
        setHiddenIds(json.hidden ?? []);
      } catch (err) {
        message.error(
          err instanceof Error ? err.message : "Chargement impossible.",
        );
      } finally {
        setLoadingEstimates(false);
      }
    },
    [message],
  );

  useEffect(() => {
    if (salonCode) void loadEstimates(salonCode);
  }, [salonCode, loadEstimates]);

  const rows: Row[] = useMemo(() => {
    const hidden = new Set(hiddenIds);
    return combinations
      .filter((combo) => !hidden.has(combo.id))
      .map((combo, index) => {
        const saved = estimates[combo.id] ?? null;
        const draft = combo.id in drafts ? drafts[combo.id] : saved;
        return {
          ...combo,
          number: index + 1,
          savedMinutes: saved,
          draftMinutes: draft,
        };
      });
  }, [combinations, estimates, drafts, hiddenIds]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.label.toLowerCase().includes(q));
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const catalogPageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  async function saveRow(row: Row) {
    if (!salonCode || row.isSimple) return;
    const minutes = row.draftMinutes;
    if (minutes == null || minutes < 1) {
      message.warning("Indiquez un temps estimé en minutes.");
      return;
    }
    setSavingId(row.id);
    try {
      const res = await apiFetch("/api/calculateur/estimates", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          [ADMIN_HEADER]: salonCode,
        },
        body: JSON.stringify({ id: row.id, minutes }),
      });
      const json = (await res.json()) as {
        estimates?: Record<string, number>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Enregistrement impossible.");
      }
      setEstimates(json.estimates ?? {});
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      message.success("Temps estimé enregistré.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function clearRow(row: Row) {
    if (!salonCode) return;
    setClearingId(row.id);
    try {
      const res = await apiFetch("/api/calculateur/estimates", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          [ADMIN_HEADER]: salonCode,
        },
        body: JSON.stringify({ id: row.id }),
      });
      const json = (await res.json()) as {
        estimates?: Record<string, number>;
        hidden?: string[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Effacement impossible.");
      }
      setEstimates(json.estimates ?? {});
      setHiddenIds(json.hidden ?? []);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      message.success("Combinaison retirée.");
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Effacement impossible.",
      );
    } finally {
      setClearingId(null);
    }
  }

  const columns: ColumnsType<Row> = [
    {
      title: "#",
      dataIndex: "number",
      key: "number",
      width: 64,
      sorter: (a, b) => a.number - b.number,
      defaultSortOrder: "ascend",
      render: (n: number) => <span className="calc-table__num">{n}</span>,
    },
    {
      title: "Combinaison",
      dataIndex: "label",
      key: "label",
      render: (label: string, row) => (
        <span className="calc-table__combo">
          {label}
          {row.isSimple ? (
            <span className="calc-table__simple"> · simple</span>
          ) : null}
        </span>
      ),
    },
    {
      title: "Temps calculé",
      dataIndex: "minutes",
      key: "minutes",
      width: 140,
      sorter: (a, b) => a.minutes - b.minutes,
      render: (minutes: number) => (
        <strong className="calc-table__computed">
          {formatDurationMinutes(minutes)}
        </strong>
      ),
    },
    {
      title: "Temps estimé (min)",
      key: "estimate",
      width: 170,
      render: (_, row) =>
        row.isSimple ? (
          <span className="calc-table__na">—</span>
        ) : (
          <InputNumber
            min={1}
            max={24 * 60}
            style={{ width: "100%" }}
            placeholder="min"
            value={row.draftMinutes ?? undefined}
            onChange={(value) => {
              setDrafts((prev) => ({
                ...prev,
                [row.id]: typeof value === "number" ? value : null,
              }));
            }}
          />
        ),
    },
    {
      title: "",
      key: "actions",
      width: 200,
      render: (_, row) => {
        const canSave =
          !row.isSimple &&
          row.draftMinutes != null &&
          row.draftMinutes >= 1 &&
          row.draftMinutes !== row.savedMinutes;
        return (
          <Space size={8}>
            {row.isSimple ? (
              <span className="calc-table__na">—</span>
            ) : (
              <Button
                type="primary"
                size="small"
                loading={savingId === row.id}
                disabled={!canSave}
                onClick={() => void saveRow(row)}
              >
                Save
              </Button>
            )}
            <Button
              danger
              size="small"
              loading={clearingId === row.id}
              onClick={() => void clearRow(row)}
            >
              Effacer
            </Button>
          </Space>
        );
      },
    },
  ];

  if (!salonCode) {
    return (
      <main className="salon-shell">
        <header className="salon-brand">
          <p className="salon-brand__eyebrow">Espace salon</p>
          <h1 className="salon-brand__name">Calculateur</h1>
          <p className="salon-brand__tagline">
            Combinaisons de prestations et temps estimés
          </p>
        </header>
        <div className="salon-card">
          <div className="salon-card__accent" />
          <div className="salon-card__body">
            <SalonUnlockForm
              submitLabel="Ouvrir le calculateur"
              onUnlocked={(code) => {
                sessionStorage.setItem(STORAGE_KEY, code);
                setSalonCode(code);
              }}
              onError={(msg) => message.error(msg)}
            />
          </div>
        </div>
        <p className="salon-footer">
          <Link to="/semaine">← Mes RDVs</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="salon-shell">
      <header className="salon-brand">
        <p className="salon-brand__eyebrow">Espace salon</p>
        <h1 className="salon-brand__name">Calculateur</h1>
        <p className="salon-brand__tagline">
          {rows.length} combinaison(s) · {catalogPageCount} page(s) — Save pour
          estimer, Effacer pour retirer une ligne
        </p>
        <p className="salon-brand__tagline calc-admin-note">
          Note : la coloration végétale est masquée sur la réservation client
          pour l’instant ; elle reste dans ce tableau pour les estimations.
        </p>
      </header>

      <div className="salon-card salon-card--wide calc-table-card">
        <div className="salon-card__accent" />
        <div className="salon-card__body">
          <section className="salon-section">
            <Input.Search
              allowClear
              size="large"
              placeholder="Filtrer une combinaison…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </section>

          <section className="salon-section">
            <Table<Row>
              rowKey="id"
              size="middle"
              loading={loadingEstimates}
              columns={columns}
              dataSource={filteredRows}
              pagination={{
                current: page,
                pageSize,
                showSizeChanger: true,
                pageSizeOptions: [15, 30, 50],
                showTotal: (total) =>
                  `${total} combinaison(s) · ${Math.max(1, Math.ceil(total / pageSize))} page(s)`,
                onChange: (nextPage, nextSize) => {
                  setPage(nextPage);
                  if (nextSize !== pageSize) {
                    setPageSize(nextSize);
                    setPage(1);
                  }
                },
              }}
              scroll={{ x: true }}
            />
          </section>

          <section className="salon-section salon-section--actions">
            <div className="salon-admin-footer">
              <nav className="salon-admin-footer__links">
                <Link to="/semaine">Mes RDVs</Link>
                <Link to="/clients">Fichier clients</Link>
                <Link to="/">Réservation</Link>
              </nav>
              <Button
                type="link"
                danger
                onClick={() => {
                  sessionStorage.removeItem(STORAGE_KEY);
                  setSalonCode(null);
                }}
              >
                Déconnexion
              </Button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
