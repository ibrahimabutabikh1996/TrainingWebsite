"use client";

import { Toaster } from "react-hot-toast";

export function StoreToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--glass-solid)",
          backdropFilter: "var(--glass-solid-blur)",
          color: "var(--text)",
          border: "1px solid var(--glass-border-strong)",
          padding: "var(--space-3) var(--space-5)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--elev-3)",
          direction: "rtl",
          fontWeight: 600,
        },
      }}
    />
  );
}
