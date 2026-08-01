"use client";

import dynamic from "next/dynamic";

const SpaRoot = dynamic(() => import("@/components/SpaRoot"), {
  ssr: false,
  loading: () => (
    <main className="salon-shell" style={{ padding: 24, textAlign: "center" }}>
      Chargement…
    </main>
  ),
});

/** Entrée unique Next : l’UI vit dans le HashRouter (`/#/…`). */
export default function HomePage() {
  return <SpaRoot />;
}
