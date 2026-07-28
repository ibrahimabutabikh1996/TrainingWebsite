"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import "./admin.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const userId = localStorage.getItem("loggedInUserId");
    const username = localStorage.getItem("loggedInUsername");
    
    if (!userId) {
      router.push("/");
    } else if (username !== "admin") {
      router.push("/dashboard");
    }
  }, [router]);

  const navItems = [
    { name: "إدارة المشتركين", path: "/admin", icon: "group" },
    { name: "مكتبة الكورسات", path: "/admin/courses", icon: "library_books" },
    { name: "صانع الكورسات", path: "/admin/builder", icon: "build" },
    { name: "التمارين", path: "/admin/exercises", icon: "fitness_center" },
    { name: "محتوى الموقع", path: "/admin/cms", icon: "web" },
  ];

  return (
    <div className="admin-layout-wrapper" dir="rtl">
      {/* Legacy Sidebar using Vanilla CSS (100% Matching Original Design) */}
      <nav className="admin-sidebar-glass">
        <div>
          {/* Header Brand */}
          <div className="admin-brand-header">
            <div className="admin-brand-icon">
              <span className="material-symbols-outlined">fitness_center</span>
            </div>
            <div>
              <p className="admin-brand-subtitle" style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--admin-on-surface)" }}>لوحة تحكم المدرب</p>
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
                  className={`admin-nav-link ${isActive ? "active" : ""}`}
                >
                  <div className="admin-nav-link-inner">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{item.icon}</span>
                    <span className="admin-nav-text">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <Link href="/account/password" className="admin-logout-btn" style={{ color: "var(--admin-on-surface)", textDecoration: "none" }}>
            <div className="admin-nav-link-inner">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>lock_reset</span>
              <span className="admin-nav-text">تغيير كلمة المرور</span>
            </div>
          </Link>

          <button
            onClick={toggleTheme}
            className="admin-logout-btn"
            style={{ color: "var(--admin-on-surface)" }}
          >
            <div className="admin-nav-link-inner">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                {theme === "light" ? "dark_mode" : "light_mode"}
              </span>
              <span className="admin-nav-text">
                {theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}
              </span>
            </div>
          </button>
          
          <button 
            onClick={() => {
              localStorage.removeItem("loggedInUserId");
              router.push("/");
            }}
            className="admin-logout-btn"
          >
            <div className="admin-nav-link-inner">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>logout</span>
              <span className="admin-nav-text">تسجيل الخروج</span>
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
