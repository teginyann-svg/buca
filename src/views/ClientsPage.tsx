"use client";

import {
  App,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Space,
  Table,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, CheckOutlined, DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ADMIN_HEADER } from "@/lib/admin-constants";
import {
  formatBirthDate,
  type ClientGender,
  type ClientRecord,
} from "@/lib/client-types";
import { checkSwissPhone } from "@/lib/swiss-phone";
import { SalonUnlockForm } from "@/components/SalonUnlockForm";
import { apiFetch } from "@/lib/api";
import { publicAsset } from "@/lib/public-asset";

const STORAGE_KEY = "reservsalon_salon_code";

function isEffectivelySuspect(client: ClientRecord): boolean {
  if (client.validatedAt) return false;
  if (client.isSuspect) return true;
  if (!client.phone.trim()) return false;
  const check = checkSwissPhone(client.phone);
  return check.looksGenerated || !check.isSwiss || !check.ok;
}

type ClientFormValues = {
  gender: ClientGender | null;
  lastName: string;
  firstName: string;
  birthDay: number | null;
  birthMonth: number | null;
  birthYear: number | null;
  address: string;
  phone: string;
  email: string;
  recettes: string[];
  firstVisitAt: Dayjs | null;
  lastVisitAt: Dayjs | null;
};

function toFormValues(client: ClientRecord | null): ClientFormValues {
  if (!client) {
    return {
      gender: null,
      lastName: "",
      firstName: "",
      birthDay: null,
      birthMonth: null,
      birthYear: null,
      address: "",
      phone: "",
      email: "",
      recettes: [""],
      firstVisitAt: null,
      lastVisitAt: null,
    };
  }
  return {
    gender: client.gender,
    lastName: client.lastName,
    firstName: client.firstName,
    birthDay: client.birthDay,
    birthMonth: client.birthMonth,
    birthYear: client.birthYear,
    address: client.address,
    phone: client.phone,
    email: client.email,
    recettes: client.recettes.length > 0 ? client.recettes : [""],
    firstVisitAt: client.firstVisitAt ? dayjs(client.firstVisitAt) : null,
    lastVisitAt: client.lastVisitAt ? dayjs(client.lastVisitAt) : null,
  };
}

export default function ClientsPage() {
  const { message, modal } = App.useApp();
  const [salonCode, setSalonCode] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<ClientFormValues>();

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) setSalonCode(saved);
  }, []);

  const loadClients = useCallback(
    async (code: string) => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/clients", {
          headers: { [ADMIN_HEADER]: code },
        });
        const json = (await res.json()) as {
          clients?: ClientRecord[];
          error?: string;
        };
        if (!res.ok) {
          if (res.status === 401) {
            sessionStorage.removeItem(STORAGE_KEY);
            setSalonCode(null);
          }
          throw new Error(json.error ?? "Chargement impossible.");
        }
        setClients(json.clients ?? []);
      } catch (err) {
        message.error(
          err instanceof Error ? err.message : "Chargement impossible.",
        );
      } finally {
        setLoading(false);
      }
    },
    [message],
  );

  useEffect(() => {
    if (salonCode) void loadClients(salonCode);
  }, [salonCode, loadClients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const blob = [
        c.firstName,
        c.lastName,
        c.phone,
        c.email,
        c.address,
        c.recettes.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [clients, search]);

  function openCreate() {
    setEditing(null);
    form.setFieldsValue(toFormValues(null));
    setDrawerOpen(true);
  }

  function openEdit(client: ClientRecord) {
    setEditing(client);
    form.setFieldsValue(toFormValues(client));
    setDrawerOpen(true);
  }

  async function downloadCsvBackup() {
    if (!salonCode) return;
    try {
      const res = await apiFetch("/api/clients/export", {
        headers: { [ADMIN_HEADER]: salonCode },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Export impossible.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `clients-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success("Backup CSV téléchargé.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Export impossible.");
    }
  }

  async function saveClient(values: ClientFormValues) {
    if (!salonCode) return;
    setSaving(true);
    try {
      const body = {
        gender: values.gender,
        lastName: values.lastName ?? "",
        firstName: values.firstName ?? "",
        birthDay: values.birthDay,
        birthMonth: values.birthMonth,
        birthYear: values.birthYear,
        address: values.address ?? "",
        phone: values.phone ?? "",
        email: values.email ?? "",
        recettes: (values.recettes ?? []).filter((r) => r != null),
        firstVisitAt: values.firstVisitAt
          ? values.firstVisitAt.format("YYYY-MM-DD")
          : null,
        lastVisitAt: values.lastVisitAt
          ? values.lastVisitAt.format("YYYY-MM-DD")
          : null,
      };

      const res = await apiFetch(
        editing ? `/api/clients/${encodeURIComponent(editing.id)}` : "/api/clients",
        {
          method: editing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            [ADMIN_HEADER]: salonCode,
          },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Enregistrement impossible.");
      message.success(editing ? "Fiche mise à jour." : "Client ajouté.");
      setDrawerOpen(false);
      await loadClients(salonCode);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(client: ClientRecord) {
    modal.confirm({
      title: "Supprimer cette fiche ?",
      content: `${client.firstName} ${client.lastName}`.trim() || client.phone,
      okText: "Supprimer",
      okButtonProps: { danger: true },
      cancelText: "Annuler",
      onOk: async () => {
        if (!salonCode) return;
        const res = await apiFetch(`/api/clients/${encodeURIComponent(client.id)}`,
          {
            method: "DELETE",
            headers: { [ADMIN_HEADER]: salonCode },
          },
        );
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          message.error(json.error ?? "Suppression impossible.");
          return;
        }
        message.success("Fiche supprimée.");
        await loadClients(salonCode);
      },
    });
  }

  async function validateSuspect(client: ClientRecord) {
    if (!salonCode) return;
    try {
      const res = await apiFetch(`/api/clients/${encodeURIComponent(client.id)}/validate`,
        {
          method: "POST",
          headers: { [ADMIN_HEADER]: salonCode },
        },
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Validation impossible.");
      message.success("Client validé.");
      await loadClients(salonCode);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Validation impossible.",
      );
    }
  }

  const columns: ColumnsType<ClientRecord> = [
    {
      title: "Sexe",
      dataIndex: "gender",
      width: 64,
      render: (g: ClientGender | null) => g ?? "—",
    },
    {
      title: "Nom",
      key: "name",
      render: (_, row) => {
        const label = `${row.lastName} ${row.firstName}`.trim() || "—";
        const suspect = isEffectivelySuspect(row);
        return (
          <span className={suspect ? "client-name--suspect" : undefined}>
            {label}
            {suspect ? (
              <span className="client-suspect-tag"> · suspect</span>
            ) : null}
          </span>
        );
      },
    },
    {
      title: "Naissance",
      key: "birth",
      width: 120,
      render: (_, row) =>
        formatBirthDate(row.birthDay, row.birthMonth, row.birthYear),
    },
    {
      title: "Téléphone",
      dataIndex: "phone",
      render: (phone: string, row) => (
        <span className={isEffectivelySuspect(row) ? "client-name--suspect" : undefined}>
          {phone || "—"}
        </span>
      ),
    },
    {
      title: "1re venue",
      dataIndex: "firstVisitAt",
      width: 110,
      render: (d: string | null) =>
        d ? dayjs(d).format("DD/MM/YYYY") : "—",
    },
    {
      title: "Dernier RDV",
      dataIndex: "lastVisitAt",
      width: 110,
      render: (d: string | null) =>
        d ? dayjs(d).format("DD/MM/YYYY") : "—",
    },
    {
      title: "",
      key: "actions",
      width: 220,
      render: (_, row) => (
        <Space size={4} wrap>
          {isEffectivelySuspect(row) ? (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => void validateSuspect(row)}
            >
              Valider
            </Button>
          ) : null}
          <Button type="link" size="small" onClick={() => openEdit(row)}>
            Éditer
          </Button>
          <Button
            type="link"
            danger
            size="small"
            onClick={() => confirmDelete(row)}
          >
            Suppr.
          </Button>
        </Space>
      ),
    },
  ];

  if (!salonCode) {
    return (
      <main className="salon-shell">
        <header className="salon-brand">
          <p className="salon-brand__eyebrow">Espace salon</p>
          <h1 className="salon-brand__name">Fichier clients</h1>
          <p className="salon-brand__tagline">
            Base clients, recettes et historique de venues
          </p>
        </header>
        <div className="salon-card">
          <div className="salon-card__accent" />
          <div className="salon-card__body">
            <SalonUnlockForm
              submitLabel="Ouvrir le fichier"
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
        <h1 className="salon-brand__name">Fichier clients</h1>
        <p className="salon-brand__tagline">
          {clients.length} fiche(s) — 1re venue &amp; dernier RDV mis à jour
          par les réservations
        </p>
      </header>

      <div className="salon-card salon-card--wide calc-table-card">
        <div className="salon-card__accent" />
        <div className="salon-card__body">
          <section className="salon-section">
            <Space
              style={{ width: "100%", justifyContent: "space-between" }}
              wrap
            >
              <Input.Search
                allowClear
                size="large"
                placeholder="Rechercher nom, téléphone, recette…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ minWidth: 240, flex: 1 }}
              />
              <Button
                size="large"
                icon={<DownloadOutlined />}
                onClick={() => void downloadCsvBackup()}
              >
                Backup CSV
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={openCreate}
              >
                Nouveau client
              </Button>
            </Space>
          </section>

          <section className="salon-section">
            <Table<ClientRecord>
              rowKey="id"
              size="middle"
              loading={loading}
              columns={columns}
              dataSource={filtered}
              pagination={{ pageSize: 12, showSizeChanger: true }}
              scroll={{ x: true }}
              rowClassName={(row) =>
                isEffectivelySuspect(row) ? "client-row--suspect" : ""
              }
            />
          </section>

          <section className="salon-section salon-section--actions">
            <div className="salon-admin-footer">
              <nav className="salon-admin-footer__links">
                <Link to="/semaine">Mes RDVs</Link>
                <Link to="/calculateur">Calculateur</Link>
                <Link to="/">Réservation</Link>
              </nav>
              <Button
                type="link"
                danger
                onClick={() => {
                  sessionStorage.removeItem(STORAGE_KEY);
                  setSalonCode(null);
                  setClients([]);
                }}
              >
                Déconnexion
              </Button>
            </div>
          </section>
        </div>
      </div>

      <Drawer
        title={editing ? "Éditer la fiche" : "Nouveau client"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={typeof window !== "undefined" ? Math.min(520, window.innerWidth) : 520}
        styles={{
          wrapper: { maxWidth: "100vw" },
        }}
        destroyOnHidden
        extra={
          <Button type="primary" loading={saving} onClick={() => form.submit()}>
            Enregistrer
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={saveClient}
          initialValues={toFormValues(null)}
        >
          <Form.Item name="gender" label="Sexe">
            <Radio.Group className="wizard-radios wizard-radios--gender">
              <Radio.Button value="F" aria-label="Femme">
                <img
                  src={publicAsset("gender-f.png")}
                  alt=""
                  width={48}
                  height={48}
                  className="wizard-gender-icon"
                />
              </Radio.Button>
              <Radio.Button value="H" aria-label="Homme">
                <img
                  src={publicAsset("gender-h.png")}
                  alt=""
                  width={48}
                  height={48}
                  className="wizard-gender-icon"
                />
              </Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="lastName" label="Nom">
            <Input size="large" placeholder="Nom" />
          </Form.Item>

          <Form.Item name="firstName" label="Prénom">
            <Input size="large" placeholder="Prénom" />
          </Form.Item>

          <Space size={12} style={{ width: "100%" }} align="start" wrap>
            <Form.Item
              name="birthDay"
              label="Naissance — jour"
              style={{ flex: 1, minWidth: 88 }}
            >
              <InputNumber
                min={1}
                max={31}
                size="large"
                style={{ width: "100%" }}
                placeholder="JJ"
              />
            </Form.Item>
            <Form.Item
              name="birthMonth"
              label="Mois"
              style={{ flex: 1, minWidth: 88 }}
            >
              <InputNumber
                min={1}
                max={12}
                size="large"
                style={{ width: "100%" }}
                placeholder="MM"
              />
            </Form.Item>
            <Form.Item
              name="birthYear"
              label="Année"
              style={{ flex: 1.2, minWidth: 104 }}
            >
              <InputNumber
                min={1900}
                max={new Date().getFullYear()}
                size="large"
                style={{ width: "100%" }}
                placeholder="AAAA"
              />
            </Form.Item>
          </Space>

          <Form.Item name="address" label="Adresse">
            <Input.TextArea rows={2} placeholder="Adresse" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Téléphone"
            rules={[
              {
                validator: async (_, value) => {
                  const raw = typeof value === "string" ? value : "";
                  if (!raw.trim()) return;
                  const check = checkSwissPhone(raw);
                  if (!check.ok) throw new Error(check.errors[0]);
                },
              },
            ]}
            extra="Tous pays acceptés. N° généré / non-suisse : signalés (pas refusés)."
          >
            <Input size="large" placeholder="079 123 45 67" inputMode="tel" />
          </Form.Item>

          <Form.Item
            name="email"
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
            extra="Email jetable : signalé (pas refusé)."
          >
            <Input size="large" placeholder="email@exemple.com" type="email" />
          </Form.Item>

          <Form.Item label="Recettes">
            <Form.List name="recettes">
              {(fields, { add, remove }) => (
                <div className="client-recettes">
                  {fields.map((field) => (
                    <div key={field.key} className="client-recette-row">
                      <Form.Item
                        {...field}
                        style={{ flex: 1, marginBottom: 0 }}
                      >
                        <Input.TextArea
                          rows={4}
                          placeholder="Recette / notes (texte libre)"
                        />
                      </Form.Item>
                      {fields.length > 1 ? (
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(field.name)}
                          aria-label="Supprimer cette recette"
                        />
                      ) : null}
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    onClick={() => add("")}
                  >
                    Ajouter une recette
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item
            name="firstVisitAt"
            label="Date première venue"
            extra="Alimentée automatiquement par les réservations"
          >
            <DatePicker
              size="large"
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="lastVisitAt"
            label="Date dernier RDV"
            extra="Alimentée automatiquement par les réservations"
          >
            <DatePicker
              size="large"
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              allowClear
            />
          </Form.Item>
        </Form>
      </Drawer>
    </main>
  );
}
