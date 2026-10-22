"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";

/** Chrome's install event. Not in the DOM typings, because no standard defines it. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "server" | "standalone" | "ios" | "other";

/* Neither answer changes while the page is open, so there is nothing to
   subscribe to; the store is read once on the client. */
const subscribeNever = () => () => {};

function detectPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "standalone";
  /* iPadOS reports itself as a Mac; the touch points give it away. */
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
    ? "ios"
    : "other";
}

/**
 * "Install the app", for a browser that would otherwise keep it in a menu.
 *
 * Two routes, because the platforms offer two:
 *
 *   - Chrome and Edge fire `beforeinstallprompt` once the site qualifies (the
 *     manifest plus a registered service worker, which is production only — see
 *     ServiceWorkerRegister). The event is held and replayed from the button,
 *     so the browser's own install dialog opens.
 *   - iOS has no install API at all. Safari only installs from Share → "Add to
 *     Home Screen", so on an iPhone or iPad the button explains exactly that.
 *
 * Renders nothing when the page is already running as the installed app, or
 * on a browser that offers neither route.
 */
export function InstallAppButton() {
  const platform = useSyncExternalStore(subscribeNever, detectPlatform, () => "server" as const);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isIos = platform === "ios";

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /* The iOS help closes on Escape or a tap anywhere outside it. */
  useEffect(() => {
    if (!showIosHelp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowIosHelp(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setShowIosHelp(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [showIosHelp]);

  if (platform === "standalone" || installed || (!deferred && !isIos)) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      /* The event can be used once; the browser fires a new one if it still applies. */
      setDeferred(null);
      return;
    }
    setShowIosHelp((open) => !open);
  };

  return (
    <div className="install-app" ref={wrapRef}>
      <button
        type="button"
        className="btn-install-app"
        onClick={handleClick}
        aria-label="ثبّت التطبيق"
        aria-expanded={deferred ? undefined : showIosHelp}
        title="ثبّت التطبيق"
      >
        <Download size={18} aria-hidden="true" />
        <span className="btn-install-app-text">ثبّت التطبيق</span>
      </button>

      {showIosHelp && (
        <div className="install-app-help" role="dialog" aria-label="طريقة تثبيت التطبيق">
          <p>
            اضغط زر المشاركة <Share size={16} aria-hidden="true" /> في Safari، ثم اختر
            «إضافة إلى الشاشة الرئيسية» <SquarePlus size={16} aria-hidden="true" />.
          </p>
        </div>
      )}
    </div>
  );
}
