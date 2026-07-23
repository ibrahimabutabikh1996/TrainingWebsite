"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export function ForgotPasswordForm({ initialUsername, onBackClick }: { initialUsername: string, onBackClick: () => void }) {
  const { t } = useLanguage();
  const [forgotUsername, setForgotUsername] = useState(initialUsername);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);

    // Mock API call for Phase 6 (Forgot Password is out of scope for now)
    setTimeout(() => {
      alert(t("forgot_success"));
      setForgotLoading(false);
      onBackClick();
    }, 2000);
  };

  return (
    <div id="forgot-view">
      <header className="brand" style={{ marginTop: 0 }}>
        <h1>{t("forgot_title")}</h1>
        <p>{t("forgot_subtitle")}</p>
      </header>

      <form id="forgot-form" onSubmit={handleForgotSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="forgot-username" className="field-label">
            <span>{t("user_label")}</span>
          </label>
          <div className="input-wrapper">
            <input 
              type="text" 
              id="forgot-username" 
              name="username" 
              required 
              autoComplete="username" 
              pattern="[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[a-zA-Z0-9_]{3,}"
              className="form-input"
              value={forgotUsername}
              onChange={(e) => setForgotUsername(e.target.value)}
            />
          </div>
        </div>

        <button type="submit" id="forgot-submit-btn" className="submit-btn" style={{ marginBottom: 16 }} disabled={forgotLoading}>
          {forgotLoading && <span className="spinner" aria-hidden="true"></span>}
          <span id="forgot-submit-btn-text">{forgotLoading ? "..." : t("forgot_submit")}</span>
        </button>

        <button 
          type="button" 
          id="back-to-login-btn" 
          className="social-btn" 
          style={{ width: "100%" }}
          onClick={onBackClick}
        >
          <span>{t("back_to_login")}</span>
        </button>
      </form>
    </div>
  );
}
