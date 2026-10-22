"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js`, which is what lets the browser offer to install the
 * site as an app. Mounted once in the root layout; renders nothing.
 *
 * Production only: under `next dev` the files in `/_next/static` are rebuilt in
 * place under the same names, and a worker serving its stored copies would hide
 * every edit until the cache was cleared by hand.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("[pwa] service worker registration failed:", error));
  }, []);

  return null;
}
