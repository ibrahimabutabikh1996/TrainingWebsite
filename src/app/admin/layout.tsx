"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import "./admin.css";
import { Icon, type IconName } from "@/components/Icon";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { logout } = useAuth();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const navItems: { name: string; path: string; icon: IconName }[] = [
    { name: "إدارة المشتركين", path: "/admin", icon: "group" },
    { name: "مكتبة الكورسات", path: "/admin/courses", icon: "library_books" },
    { name: "صانع الكورسات", path: "/admin/builder", icon: "fitness_center" },
    { name: "التمارين", path: "/admin/exercises", icon: "biceps_flexed" },
    { name: "النظام الغذائي", path: "/admin/diet", icon: "restaurant_menu" },
    { name: "محتوى الموقع", path: "/admin/cms", icon: "web" },
  ];

  return (
    <div className="admin-layout-wrapper" dir="rtl">
      {/* Main Content Area */}
      <main className="admin-main-content">{children}</main>

      {/* Bottom Navbar */}
      <nav className="admin-bottom-nav">
        {/* Right Brand Logo (Starts first in RTL) */}
        <div className="admin-brand-header">
          <Link
            href="/"
            title="العودة للصفحة الرئيسية"
            className="admin-collapsed-logo-tile admin-logo-mobile"
          >
            <img
              /* Drawn at 36px and hidden outright above the phone breakpoint —
                 but `display: none` does not stop the fetch, so the full 2048px
                 original (139 KB) was downloaded on every admin page and then
                 never painted. */
              src={optimizedSrc("/images/logo/mainLogo.png", 96)}
              alt="Ibrahim Abutabikh Main Logo"
              decoding="async"
              style={{
                width: "36px",
                height: "36px",
                objectFit: "contain",
                display: "block",
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
              }}
            />
          </Link>
          <Link
            href="/"
            title="العودة للصفحة الرئيسية"
            className="admin-hlogo-link admin-logo-desktop"
          >
            <img
              /* 5170x824 for a 200x60 box: 184 KB on every admin page. The
                 landing page has asked for these same three widths since the
                 optimiser was introduced; the panel never did. */
              src={optimizedSrc("/images/logo/hLogo.png", 384)}
              srcSet={optimizedSrcSet("/images/logo/hLogo.png", [384, 640])}
              sizes="200px"
              alt="Ibrahim Abutabikh Logo"
              decoding="async"
              style={{
                maxHeight: "60px",
                height: "auto",
                width: "100%",
                maxWidth: "200px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </Link>
        </div>

        {/* Center Nav Links */}
        <div className="admin-nav-container">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                title={item.name}
                className={`admin-nav-link ${isActive ? "active" : ""}`}
              >
                <Icon name={item.icon} className="app-icon" />
              </Link>
            );
          })}
        </div>

        {/* Left Actions (Settings Dropdown) */}
        <div
          className="admin-bottom-actions"
          ref={settingsRef}
          style={{ position: "relative" }}
        >
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`admin-logout-btn ${isSettingsOpen ? "active" : ""}`}
            title="الإعدادات"
          >
            <Icon name="settings" className="app-icon" />
          </button>

          {isSettingsOpen && (
            <div className="admin-settings-dropdown">
              <Link
                href="/account/password"
                className="admin-dropdown-item"
                onClick={() => setIsSettingsOpen(false)}
              >
                <Icon name="lock_reset" />
                <span>تغيير كلمة المرور</span>
              </Link>

              <div className="admin-dropdown-divider"></div>

              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  logout();
                }}
                className="admin-dropdown-item danger"
              >
                <Icon name="logout" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Every "are you sure?" in the panel comes out here, mounted once the
          way the root layout mounts the upload window. It draws nothing until
          `confirmDialog()` is called. Panel-only on purpose: all the callers
          are these screens, and mounting it here keeps crm.css out of the
          bundle the public pages ship. */}
      <ConfirmDialog />
    </div>
  );
}
