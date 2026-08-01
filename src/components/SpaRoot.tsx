"use client";

import { App } from "@/App";
import { AppProviders } from "@/components/AppProviders";

export default function SpaRoot() {
  return (
    <AppProviders>
      <App />
    </AppProviders>
  );
}
