"use client";

import { Button, Form, Input } from "antd";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { ADMIN_HEADER } from "@/lib/admin-constants";

type Props = {
  title?: string;
  submitLabel: string;
  onUnlocked: (code: string) => void;
  onError: (message: string) => void;
};

export async function verifySalonCode(code: string): Promise<void> {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error("Entrez le code salon.");
  }

  const res = await apiFetch("/api/admin/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [ADMIN_HEADER]: trimmed,
      Authorization: `Bearer ${trimmed}`,
    },
    body: JSON.stringify({ code: trimmed }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Code salon invalide.");
  }
}

export function SalonUnlockForm({ submitLabel, onUnlocked, onError }: Props) {
  const [form] = Form.useForm<{ code: string }>();
  const [submitting, setSubmitting] = useState(false);

  async function onFinish(values: { code: string }) {
    setSubmitting(true);
    try {
      const code = (values.code ?? "").trim();
      await verifySalonCode(code);
      onUnlocked(code);
      form.resetFields();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Code salon invalide.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      onFinish={(values) => void onFinish(values)}
    >
      <section className="salon-section">
        <Form.Item
          name="code"
          label={<span className="salon-label">Code salon</span>}
          rules={[{ required: true, message: "Entrez le code salon." }]}
        >
          <Input.Password
            size="large"
            placeholder="Votre code"
            autoComplete="current-password"
            visibilityToggle
          />
        </Form.Item>
      </section>
      <section className="salon-section salon-section--actions">
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            size="large"
            block
            htmlType="submit"
            loading={submitting}
          >
            {submitLabel}
          </Button>
        </Form.Item>
      </section>
    </Form>
  );
}
