import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UploadProgressWindow } from "@/components/upload/UploadProgressWindow";

export const metadata: Metadata = {
  title: "Ibrahim Abutabikh",
  description: "خطط تدريب وأنظمة غذائية مخصصة مع متابعة كاملة",
  icons: {
    icon: "/images/logo/mainLogo.png",
  },
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
        {children}
        {/* Every upload in the system reports into this one window, so it is
            mounted once here rather than per screen. It renders nothing until a
            file is actually on its way. */}
        <UploadProgressWindow />
      </body>
    </html>
  );
}
