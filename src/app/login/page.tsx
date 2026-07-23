"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { getLandingContent } from "../admin/cms/actions";
import './login.css';

export default function LoginPage() {
  const { lang, toggleLang, t } = useLanguage();
  const { toggleTheme } = useTheme();
  const [cmsData, setCmsData] = useState<any>(null);

  useEffect(() => {
    async function loadCMS() {
      const previewData = localStorage.getItem("cms_preview_data");
      if (previewData) {
        try {
          const parsed = JSON.parse(previewData);
          // Only use preview data if it matches current lang
          if (parsed.lang === lang) {
            setCmsData(parsed.payload);
            return;
          }
        } catch (e) {}
      }

      const res = await getLandingContent();
      if (res) {
        setCmsData(lang === "ar" ? res.content_ar : res.content_en);
      }
    }
    loadCMS();

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "CMS_PREVIEW") {
        if (e.data.lang === lang) {
          setCmsData(e.data.payload);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [lang]);

  const bgStyle = cmsData?.login_bg_url ? { 
    background: `linear-gradient(135deg, color-mix(in srgb, var(--bg) 60%, transparent) 0%, color-mix(in srgb, var(--bg) 20%, transparent) 60%, color-mix(in srgb, var(--bg) 75%, transparent) 100%), url("${cmsData.login_bg_url}") center/cover no-repeat` 
  } : {};

  return (
    <div className="page">
      {/* Noise overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', opacity: 0.025,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'
      }}></div>

      {/* Top Glass Navbar */}
      <header className="top-bar">
        <Link href="/" className="image-logo">
          <div className="image-logo-mark">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          {t("site_title")}
        </Link>

        <div className="nav-actions">
          <button 
            className="theme-toggle" 
            onClick={toggleTheme} 
            aria-label="Toggle theme"
          >
            <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
          <button 
            className="lang-toggle" 
            onClick={toggleLang} 
            aria-label="Switch Language"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* LEFT: Image panel */}
      <div className="panel-image">
        <div className="panel-image-bg" style={bgStyle}></div>
        <div className="panel-image-content">
          {cmsData?.login_title && (
            <div style={{ marginTop: 'auto', marginBottom: '10vh', maxWidth: '480px', animation: 'fadeUp 0.8s ease-out' }}>
              <h1 style={{ fontSize: '3.5rem', fontFamily: 'var(--font-display)', marginBottom: '16px', lineHeight: 1.1, color: 'var(--text)' }}>
                {cmsData.login_title.split('\\n').map((line: string, i: number) => (
                  <span key={i} style={{ display: 'block' }}>{line}</span>
                ))}
              </h1>
              {cmsData?.login_subtitle && (
                <p style={{ fontSize: '1.25rem', color: 'var(--text)', opacity: 0.85, lineHeight: 1.6, fontWeight: 500 }}>
                  {cmsData.login_subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Form panel */}
      <div className="panel-form">
        <LoginForm />
      </div>
    </div>
  );
}
