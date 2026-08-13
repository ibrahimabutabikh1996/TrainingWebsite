"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t } from "@/lib/translations";
import { useTheme } from "@/contexts/ThemeContext";
import "./password.css";

const MIN_LENGTH = 8;

/* Rough strength read for the meter only — the server enforces the real rule.
   Deliberately not a score anyone can game: it just rewards length and variety. */
function strengthOf(value: string): 0 | 1 | 2 | 3 {
  if (value.length < MIN_LENGTH) return value.length === 0 ? 0 : 1;
  let variety = 0;
  if (/[a-z]/.test(value)) variety++;
  if (/[A-Z]/.test(value)) variety++;
  if (/[0-9]/.test(value)) variety++;
  if (/[^A-Za-z0-9]/.test(value)) variety++;
  if (value.length >= 12 && variety >= 3) return 3;
  if (variety >= 2) return 2;
  return 1;
}

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/* Local storage is an external store, so it's subscribed to rather than copied
   into state inside an effect. The server snapshot is null, which keeps the
   server render and the first client render in agreement. */
const listeners = new Set<() => void>();

const subscribeToStorage = (onChange: () => void) => {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
};

/* The `storage` event fires only in *other* tabs, so a write from this one has to
   notify subscribers by hand or the screen keeps rendering the old value. */
function clearStoredSession() {
  localStorage.removeItem("loggedInUserId");
  localStorage.removeItem("loggedInUsername");
  listeners.forEach((notify) => notify());
}

function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    subscribeToStorage,
    () => localStorage.getItem(key),
    () => null
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  hint?: string;
}

function PasswordField({ id, label, value, onChange, autoComplete, hint }: FieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="pw-field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-input-wrap">
        <span className="pw-input-icon"><LockIcon /></span>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
          placeholder="••••••••"
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hide_password") : t("show_password")}
        >
          <EyeIcon off={visible} />
        </button>
      </div>
      {hint && <span className="pw-hint">{hint}</span>}
    </div>
  );
}

export default function ChangePasswordPage() {

  const { toggleTheme } = useTheme();
  const router = useRouter();

  const userId = useStoredValue("loggedInUserId");
  const username = useStoredValue("loggedInUsername") ?? "";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = strengthOf(next);
  const strengthLabel = [null, t("pw_strength_weak"), t("pw_strength_fair"), t("pw_strength_strong")][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userId) return setError(t("pw_not_logged_in"));
    if (next.length < MIN_LENGTH) return setError(t("pw_too_short"));
    if (next !== confirm) return setError(t("pw_mismatch"));
    if (next === current) return setError(t("pw_same"));

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, currentPassword: current, newPassword: next }),
      });
      const body = await res.json();
      if (!res.ok) {
        /* 404 means the stored id names an account that no longer exists — after
           the account-clearing script has run, for instance. Nothing the user
           types can succeed while that id is held, so drop the dead session and
           let the sign-in prompt take over. */
        if (res.status === 404) clearStoredSession();
        setError(body.error || "…");
        return;
      }
      /* Clear the values from component state as soon as they're no longer needed. */
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  };

  const homeHref = (username === "admin" || username === "mkm94admin") ? "/admin" : "/dashboard";

  return (
    <div className="pw-page" lang="ar">
      <header className="pw-topbar">
        <Link href={homeHref} className="pw-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>{t("pw_back")}</span>
        </Link>
        <div className="pw-topbar-actions">
          <button onClick={toggleTheme} aria-label="تبديل المظهر">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="pw-main">
        <section className="pw-card">
          <span className="pw-badge"><LockIcon /></span>
          <h1 className="pw-title">{t("pw_title")}</h1>
          <p className="pw-subtitle">{t("pw_subtitle")}</p>

          {done ? (
            <div className="pw-done" role="status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <p>{t("pw_success")}</p>
              <button className="pw-submit" onClick={() => router.push(homeHref)}>
                {t("pw_back")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="pw-error" role="alert">
                  <span aria-hidden="true">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Without a stored id the submit button is disabled, so the page
                  would otherwise dead-end here with no way forward. */}
              {!userId && (
                <div className="pw-error" role="alert">
                  <span aria-hidden="true">⚠️</span>
                  <span>{t("pw_not_logged_in")}</span>
                  <Link href="/login" className="pw-error-action">
                    {t("submit_btn")}
                  </Link>
                </div>
              )}

              <PasswordField
                id="current-password"
                label={t("pw_current")}
                value={current}
                onChange={setCurrent}
                autoComplete="current-password"
              />

              <PasswordField
                id="new-password"
                label={t("pw_new")}
                value={next}
                onChange={setNext}
                autoComplete="new-password"
                hint={t("pw_hint")}
              />

              {next.length > 0 && (
                <div className="pw-strength" data-level={strength}>
                  <span className="pw-strength-bar"><i /><i /><i /></span>
                  <span className="pw-strength-label">{strengthLabel}</span>
                </div>
              )}

              <PasswordField
                id="confirm-password"
                label={t("pw_confirm")}
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />

              <button type="submit" className="pw-submit" disabled={saving || !userId}>
                {saving && <span className="pw-spinner" aria-hidden="true" />}
                {saving ? t("pw_saving") : t("pw_submit")}
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
