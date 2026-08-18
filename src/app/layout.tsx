import type { Metadata } from "next";
import "./globals.css";
import { UploadProgressWindow } from "@/components/upload/UploadProgressWindow";

export const metadata: Metadata = {
  title: "Ibrahim Abutabikh",
  description: "خطط تدريب وأنظمة غذائية مخصصة مع متابعة كاملة",
  icons: {
    icon: "/images/logo/mainLogo.png",
  },
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
