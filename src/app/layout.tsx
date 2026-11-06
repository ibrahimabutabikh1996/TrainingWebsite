import type { Metadata, Viewport } from "next";
import "./globals.css";
/* Lit Glass — the design system on top of the tokens in globals.css. See
   src/styles/lit/tokens.css for how the levels work. */
import "@/styles/lit/tokens.css";
import "@/styles/lit/primitives.css";
import "@/styles/lit/fields.css";
import "@/styles/lit/surfaces.css";
import "@/styles/lit/navigation.css";
import "@/styles/lit/feedback.css";
import "@/styles/lit/status.css";
import { UploadProgressWindow } from "@/components/upload/UploadProgressWindow";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { SITE_URL } from "@/lib/siteUrl";
import GlassPointer from "@/components/GlassPointer";

const SITE_NAME = "Ibrahim Abutabikh";
const SITE_DESCRIPTION = "خطط تدريب وأنظمة غذائية مخصصة مع متابعة كاملة";
/* 2048×1058 — close enough to the 1.91:1 the share cards crop to. */
const SHARE_IMAGE = "/images/logo/vLogo.png";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "إبراهيم أبو طبيخ",
    "مدرب شخصي",
    "تدريب أونلاين",
    "برنامج تدريبي",
    "نظام غذائي",
    "دايت",
    "لياقة بدنية",
    "personal trainer",
    "online coaching",
  ],
  openGraph: {
    type: "website",
    locale: "ar_AR",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: SHARE_IMAGE, width: 2048, height: 1058, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

/* What Google reads to understand who the site is for. Built from constants
   only, but escaped all the same, as Next's JSON-LD guide asks. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.png`,
  image: `${SITE_URL}${SHARE_IMAGE}`,
};

/**
 * Next already emitted `width=device-width, initial-scale=1` by default; the
 * reason to declare it is the third value.
 *
 * `viewportFit: "cover"` lets the page use the whole screen on a phone with a
 * notch or a Dynamic Island instead of being letterboxed between the safe
 * insets — and, more to the point, it is the switch that makes
 * `env(safe-area-inset-*)` report anything at all. Without it those values are
 * always zero, so every rule written against them is dead code. With it, the
 * page is responsible for keeping its own fixed furniture clear of the cutout:
 * the admin bar, the landing header and its drawer, the dialog scrim and the
 * scroll button all pad themselves against those insets.
 *
 * No `maximumScale` and no `userScalable: false`. Pinch-zoom is how a reader
 * who needs larger text gets it, and turning it off to stop iOS focus-zoom
 * would trade an accessibility guarantee for a cosmetic one — the inputs are
 * set at 16px on phones instead, which stops the zoom at its cause.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /* `--bg`, as in `manifest.ts` — the colour of the phone's status bar. */
  themeColor: "#0A121A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /* `data-scroll-behavior` is read by the router, not by the browser.
   *
   * `landing.css` sets `scroll-behavior: smooth` on `html` so the home page's
   * nav links glide to their section, and until Next 16 the router quietly
   * forced `auto` for the length of a route change so navigation still landed
   * instantly. Version 16 stopped doing that unless this attribute asks for it,
   * and warns in development when it finds smooth scrolling without it.
   *
   * So this restores what the site already had: a route change jumps, an anchor
   * gliding within a page does not. The nav links are plain `<a href="#…">` and
   * never reach the router at all, and the router's own helper returns early for
   * a hash-only change in any case — see
   * next/dist/shared/lib/router/utils/disable-smooth-scroll.js, which is both
   * where the override lives and where the warning is gated to development. */
  return (
    <html lang="ar" dir="rtl" data-scroll-behavior="smooth">
      <body>
        {/* The ambient light the glass frosts over, and the cursor's light on
            the cards. Renders three decorative layers; see the component. */}
        <GlassPointer />
        {children}
        {/* Every upload in the system reports into this one window, so it is
            mounted once here rather than per screen. It renders nothing until a
            file is actually on its way. */}
        <UploadProgressWindow />
        <ServiceWorkerRegister />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
