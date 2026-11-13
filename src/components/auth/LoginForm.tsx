"use client";

import { useState } from "react";
import { t } from "@/lib/translations";
import { useAuth } from "@/hooks/useAuth";

import Link from "next/link";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function LoginForm() {
  const { login, isLoading, error, setError } = useAuth();

  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    /* Cleared first so a second failure restarts the shake rather than
       leaving the class on and the card still. */
    setShake(false);
    /* An empty field used to go to the server and come back as "wrong
       username or password". Say which one is empty, and put the cursor in it. */
    const empty = !username.trim() ? "username" : !password ? "password" : null;
    if (empty) {
      setError(`يرجى إدخال ${t(empty === "username" ? "user_label" : "password_label")}`);
      setShake(true);
      document.getElementById(empty)?.focus();
      return;
    }
    const ok = await login(username, password, remember, t("login_error_msg"));
    if (!ok) setShake(true);
  };

  const handleCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  return (
    <div
      className={shake ? "form-card is-shaking" : "form-card"}
      onAnimationEnd={(e) => {
        /* The fields' own entrance animations bubble up to here too. */
        if (e.target === e.currentTarget) setShake(false);
      }}
    >
      <div className="form-eyebrow">{t("welcome_back")}</div>
      <div className="form-title">{t("submit_btn")}</div>
      <div className="form-divider"></div>

      <form onSubmit={handleSubmit} noValidate>

        {error && (
          <Alert variant="destructive" style={{ marginBottom: 20 }}>
            <AlertCircle />
            <AlertTitle>خطأ</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="field-group">
          <div className="field">
            <label htmlFor="username">{t("user_label")}</label>
            <div className="field-input-wrap">
              <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <input 
                type="text" 
                id="username" 
                name="username" 
                required 
                autoComplete="username" 
                pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_]{3,}"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("user_hint")}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">{t("password_label")}</label>
            <div className="field-input-wrap">
              <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input 
                type={showPassword ? "text" : "password"} 
                id="password" 
                name="password" 
                required 
                autoComplete="current-password" 
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={handleCapsLock}
                onKeyUp={handleCapsLock}
                onBlur={() => setCapsLock(false)}
                placeholder="••••••••"
              />
              <button 
                type="button" 
                className="field-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t("hide_password") : t("show_password")}
              >
                {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                )}
              </button>
            </div>
            {capsLock && (
              <div className="field-hint" role="alert">
                مفتاح Caps Lock مفعّل
              </div>
            )}
          </div>
        </div>

        <div className="field-meta">
          <label className="remember" htmlFor="remember">
            <input type="checkbox" id="remember" name="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <div className="checkbox-box"></div>
            <span>{t("remember_me")}</span>
          </label>
        </div>

        <button type="submit" className="btn-submit" disabled={isLoading} aria-busy={isLoading}>
          {isLoading ? (
            <>
              <span className="btn-spinner" aria-hidden="true"></span>
              جاري الدخول…
            </>
          ) : t("submit_btn")}
        </button>

        <div className="or-divider">
          <div className="or-line"></div>
          <span>لست مشتركاً؟</span>
          <div className="or-line"></div>
        </div>

        <Link href="/#membership" className="btn-register-card">
          تسجيل جديد في الخطط
        </Link>
      </form>
    </div>
  );
}
