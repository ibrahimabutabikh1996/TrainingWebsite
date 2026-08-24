"use client";
import type { JsonRecord } from "@/types";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { t } from "@/lib/translations";
import { LoginForm } from "@/components/auth/LoginForm";
import { PreviewBar } from "@/components/ui/PreviewBar";
import { safeMediaUrl } from "@/lib/richText";
import { getLandingContent } from "@/app/admin/cms/actions";

interface Props {
  /**
   * The coach's unsaved draft, rendered instead of the published copy.
   *
   * True only on `/cms-preview/login`, which is an admin route. This is what
   * turns on the two things a preview needs — reading the draft the content
   * manager left in local storage, and listening for the edits it keeps
   * pushing — and both of them stay off the public sign-in page entirely.
   *
   * That separation is the point of this component existing. The preview used
   * to be `/login?preview=true`, so the page where passwords are typed carried
   * the draft reader and a `postMessage` listener for the benefit of a screen
   * only the coach ever opens. Both had already been the source of real
   * defects there: every visitor once read `cms_preview_data` and rendered
   * whatever it held, and the listener went unchecked for its origin, which
   * was demonstrated to make this page fetch an address of the sender's
   * choosing. Neither can recur on `/login` now, because neither is there.
   */
  isPreview?: boolean;
  /** Published content, read on the server. The preview route passes its own. */
  initialCmsData?: JsonRecord | null;
}

/**
 * The sign-in screen, rendered identically for the visitor and for the coach's
 * preview of it.
 *
 * `LoginForm` — the part that actually authenticates — is a separate component
 * and is untouched by any of this; this file is the frame around it: the
 * background, the headline and the copy the content manager owns.
 */
export function LoginScreen({ isPreview = false, initialCmsData = null }: Props) {
  const [cmsData, setCmsData] = useState<JsonRecord | null>(initialCmsData);

  useEffect(() => {
    async function loadCMS() {
      if (isPreview) {
        const previewData = localStorage.getItem("cms_preview_data");
        if (previewData) {
          try {
            const parsed = JSON.parse(previewData);
            setCmsData(parsed.payload);
            return;
          } catch {}
        }
      }

      /* No draft, or not a preview: show what is actually published, which is
         the honest answer to "what would a visitor see". */
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

    /* Outside the preview there is no draft to receive, so there is nothing to
       listen for. Not attaching the listener at all is a smaller surface than
       attaching one that filters — and on the public page it is now never
       attached, because `isPreview` is false there by construction. */
    if (!isPreview) return;

    const handleMessage = (e: MessageEvent) => {
      /* The origin, checked. `X-Frame-Options: DENY` stops this page being
         framed, but it does not stop `window.open` — and a window handle is all
         `postMessage` needs. The sender addresses a specific origin
         (AdminCMSClient posts to `window.location.origin` rather than "*");
         this is the other half of that. */
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "CMS_PREVIEW") {
        setCmsData(e.data.payload);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isPreview]);

  /* Interpolated into a CSS `url(...)`, so it goes through `safeMediaUrl`
     first: a value carrying a quote and a paren closes the `url()` early and
     keeps writing inside the same declaration. `safeMediaUrl` refuses quotes,
     parens, backslashes, whitespace and control characters, and allows only
     http(s) or a same-origin path. Anything else comes back null and the panel
     keeps its own background. */
  const safeBg = safeMediaUrl(cmsData?.login_bg_url);
  const bgStyle = safeBg
    ? {
        background: `linear-gradient(135deg, color-mix(in srgb, var(--bg) 60%, transparent) 0%, color-mix(in srgb, var(--bg) 20%, transparent) 60%, color-mix(in srgb, var(--bg) 75%, transparent) 100%), url("${safeBg}") center/cover no-repeat`,
      }
    : {};

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
          {/* `min(280px, 100%)` rather than a flat 280px: the flat cap is wider
              than the space a phone leaves once the header's padding and the
              register button are accounted for, and an inline style cannot be
              narrowed by a media query. */}
          <div className="image-logo-mark" style={{ height: "48px", maxWidth: "min(280px, 100%)" }}>
            <img src="/images/logo/hLogo.png" alt="Ibrahim Abutabikh Logo" style={{ maxHeight: "48px", height: "100%", width: "auto", objectFit: "contain", display: "block" }} />
          </div>
        </Link>

        <div className="nav-actions">
          <Link href="/#membership" className="btn-nav-register">
            تسجيل جديد
          </Link>
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

      {/* Same bar the home-page preview shows — see @/components/ui/PreviewBar. */}
      {isPreview && <PreviewBar />}
    </div>
  );
}
