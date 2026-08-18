"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import "./admin.css";
import { Icon, type IconName } from "@/components/Icon";

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
              src="/images/logo/mainLogo.png"
              alt="Ibrahim Abutabikh Main Logo"
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
              src="/images/logo/hLogo.png"
              alt="Ibrahim Abutabikh Logo"
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
    </div>
  );
}
