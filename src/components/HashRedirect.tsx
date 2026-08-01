"use client";

import { useEffect } from "react";

/** Anciennes URLs Next → hash ReactPress / SPA. */
export default function HashRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(`/${to.startsWith("#") ? to : `#${to}`}`);
  }, [to]);

  return (
    <main className="salon-shell" style={{ padding: 24, textAlign: "center" }}>
      Redirection…
    </main>
  );
}
