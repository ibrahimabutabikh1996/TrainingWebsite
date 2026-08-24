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
  return (
    <html lang="ar" dir="rtl">
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
