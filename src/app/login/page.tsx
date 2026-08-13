"use client";
import type { JsonRecord } from "@/types";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { t } from "@/lib/translations";
import { useTheme } from "@/contexts/ThemeContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { getLandingContent } from "../admin/cms/actions";
import './login.css';

export default function LoginPage() {
  const { toggleTheme } = useTheme();
  const [cmsData, setCmsData] = useState<JsonRecord | null>(null);

  useEffect(() => {
    async function loadCMS() {
      const previewData = localStorage.getItem("cms_preview_data");
      if (previewData) {
        try {
          const parsed = JSON.parse(previewData);
          setCmsData(parsed.payload);
          return;
        } catch {}
      }

      const res = await getLandingContent();
      if (res) {
        /* The stored column is a free-form JSON value; only an object is usable
           as content, so anything else is treated as absent. */
        const content = res.content_ar;
        if (content && typeof content === "object" && !Array.isArray(content)) {
          setCmsData(content as JsonRecord);
        }
      }
    }
    loadCMS();

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "CMS_PREVIEW") {
        setCmsData(e.data.payload);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

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
        <Link href="/" className="image-logo" title="العودة للصفحة الرئيسية">
          <div className="image-logo-mark" style={{ height: "48px", maxWidth: "280px" }}>
            <img src="/images/logo/hLogo.png" alt="Ibrahim Abutabikh Logo" style={{ maxHeight: "48px", height: "100%", width: "auto", objectFit: "contain", display: "block" }} />
          </div>
        </Link>

        <div className="nav-actions">
          <Link href="/#membership" className="btn-nav-register">
            تسجيل جديد
          </Link>
          <button 
            className="theme-toggle" 
            onClick={toggleTheme} 
            aria-label="تبديل المظهر"
          >
            <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* LEFT: Image panel */}
      <div className="panel-image">
        <div className="panel-image-bg" style={bgStyle}></div>
        <div className="panel-image-content">
          <div style={{ marginTop: 'auto', marginBottom: '10vh', maxWidth: '480px', animation: 'fadeUp 0.8s ease-out' }}>
            <h1 style={{ fontSize: '3.5rem', fontFamily: 'var(--font-display)', marginBottom: '16px', lineHeight: 1.1, color: 'var(--text)' }}>
              {(cmsData?.login_title || t("title")).split('\\n').map((line: string, i: number) => (
                <span key={i} style={{ display: 'block' }}>{line}</span>
              ))}
            </h1>
            <p style={{ fontSize: '1.25rem', color: 'var(--text)', opacity: 0.85, lineHeight: 1.6, fontWeight: 500 }}>
              {cmsData?.login_subtitle || t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT: Form panel */}
      <div className="panel-form">
        <Suspense fallback={<div>جاري التحميل...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
