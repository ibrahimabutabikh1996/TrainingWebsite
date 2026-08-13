"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import "./admin.css";
import { Icon, type IconName } from "@/components/Icon";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  /* The guard that used to live here — read two localStorage keys, redirect if
     they look wrong — is gone. It ran after the browser already held the page
     and everything the server had put in it, so it hid the panel without ever
     protecting it. Each admin page now calls `requireAdminPage()` before its
     first query, and the middleware turns strangers away before that. What is
     left here is the sidebar's own state. */
  useEffect(() => {
    /* On a phone the 268px rail leaves the page itself almost no width, so a
       narrow viewport starts on the icon strip regardless of the saved
       preference. The toggle still works — this only picks the initial state. */
    const savedCollapse = localStorage.getItem("admin_sidebar_collapsed");
    if (savedCollapse === "true" || window.matchMedia("(max-width: 900px)").matches) {
      setIsCollapsed(true);
    }
  }, []);

  /* …and collapses again if the viewport becomes narrow later, e.g. on a
     rotation. Expanding again is left to the coach. */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsCollapsed(true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleToggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("admin_sidebar_collapsed", String(nextState));
  };

  const navItems: { name: string, path: string, icon: IconName }[] = [
    { name: "إدارة المشتركين", path: "/admin", icon: "group" },
    { name: "مكتبة الكورسات", path: "/admin/courses", icon: "library_books" },
    { name: "صانع الكورسات", path: "/admin/builder", icon: "build" },
    { name: "التمارين", path: "/admin/exercises", icon: "fitness_center" },
    { name: "النظام الغذائي", path: "/admin/diet", icon: "restaurant_menu" },
    { name: "محتوى الموقع", path: "/admin/cms", icon: "web" },
  ];

  return (
    <div className="admin-layout-wrapper" dir="rtl" style={{ "--sidebar-width": isCollapsed ? "92px" : "268px" } as React.CSSProperties}>
      {/* Ultra-Premium SaaS Sidebar (Linear & Apple Pro Studio Architecture) */}
      <nav className={`admin-sidebar-glass ${isCollapsed ? "collapsed" : ""}`}>
        <div>
          {/* Header Brand & Home Link */}
          <div className="admin-brand-header">
            {isCollapsed ? (
              <Link href="/" title="العودة للصفحة الرئيسية" className="admin-collapsed-logo-tile">
                <img 
                  src="/images/logo/mainLogo.png" 
                  alt="Ibrahim Abutabikh Main Logo" 
                  style={{ width: "36px", height: "36px", objectFit: "contain", display: "block", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))" }} 
                />
              </Link>
            ) : (
              <Link href="/" title="العودة للصفحة الرئيسية" className="admin-hlogo-link">
                <img 
                  src="/images/logo/hLogo.png" 
                  alt="Ibrahim Abutabikh Logo" 
                  style={{ maxHeight: "44px", height: "auto", width: "100%", maxWidth: "190px", objectFit: "contain", display: "block" }} 
                />
              </Link>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", gap: "10px", paddingBottom: "12px", borderBottom: "1px solid color-mix(in srgb, var(--admin-on-surface) 8%, transparent)", width: "100%" }}>
              {!isCollapsed && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, overflow: "hidden" }}>
                  <div className="admin-brand-icon">
                    <Icon name="fitness_center" style={{ fontSize: 18 }} />
                  </div>
                  <p className="admin-brand-subtitle">
                    لوحة تحكم المدرب
                  </p>
                </div>
              )}
              <button
                onClick={handleToggleCollapse}
                className="admin-collapse-btn"
                title={isCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
              >
                <Icon name={isCollapsed ? "chevron_left" : "chevron_right"} style={{ fontSize: 20 }} />
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="admin-nav-container">
            <p className="admin-nav-label">القائمة الرئيسية</p>
            
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  href={item.path} 
                  title={isCollapsed ? item.name : undefined}
                  className={`admin-nav-link ${isActive ? "active" : ""}`}
                >
                  <div className="admin-nav-link-inner">
                    <Icon name={item.icon} className="app-icon" />
                    <span className="admin-nav-text">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer System Actions */}
        <div className="admin-bottom-actions">
          <Link 
            href="/account/password" 
            className="admin-logout-btn" 
            title={isCollapsed ? "تغيير كلمة المرور" : undefined}
            style={{ textDecoration: "none" }}
          >
            <div className="admin-nav-link-inner">
              <Icon name="lock_reset" className="app-icon" />
              <span className="admin-nav-text">تغيير كلمة المرور</span>
            </div>
          </Link>

          <button
            onClick={toggleTheme}
            className="admin-logout-btn"
            title={isCollapsed ? (theme === "light" ? "الوضع الليلي" : "الوضع النهاري") : undefined}
          >
            <div className="admin-nav-link-inner">
              <Icon name={theme === "light" ? "dark_mode" : "light_mode"} className="app-icon" />
              <span className="admin-nav-text">
                {theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}
              </span>
            </div>
          </button>
          
          <button
            onClick={logout}
            className="admin-logout-btn danger-btn"
            title={isCollapsed ? "تسجيل الخروج" : undefined}
          >
            <div className="admin-nav-link-inner">
              {/* var(--error), not the old literal #FF5A5F: that red was picked
                  for a dark sidebar and only cleared 3.0:1 on the light theme. */}
              <Icon name="logout" className="app-icon" style={{ color: isCollapsed ? "var(--error)" : undefined }} />
              <span className="admin-nav-text" style={{ color: "var(--error)", fontWeight: "var(--weight-semibold)" }}>تسجيل الخروج</span>
            </div>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="admin-main-content">
        {children}
      </main>
    </div>
  );
}
