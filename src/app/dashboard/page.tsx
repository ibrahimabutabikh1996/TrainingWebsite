"use client";

import { HeaderControls } from "@/components/HeaderControls";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProfileStats } from "@/components/dashboard/ProfileStats";
import { DietPlan } from "@/components/dashboard/DietPlan";
import { WaterTracker } from "@/components/dashboard/WaterTracker";
import { UserAnswers } from "@/components/dashboard/UserAnswers";
import { WorkoutPlan } from "@/components/dashboard/WorkoutPlan";
import { RestDays } from "@/components/dashboard/RestDays";
import "./dashboard.css";
import Link from "next/link";

export default function DashboardPage() {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const { profile, loading, error } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem("loggedInUsername") === "admin") {
      router.push("/admin");
    }
  }, [router]);

  if (loading) {
    return (
      <div className="dashboard-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="spinner" style={{ display: "block", width: 40, height: 40, borderWidth: 3, borderColor: "var(--border)", borderTopColor: "var(--primary)", margin: "0 auto 16px auto" }}></div>
          <p style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--muted2)" }}>{t("dash_checking_db")}</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="dashboard-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--error)" }}>{error || "Profile not found"}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Top Glass Navbar matching login page */}
      <header className="top-bar">
        <Link href="/" className="image-logo">
          <div className="image-logo-mark">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          {t("site_title")}
        </Link>
        <div className="nav-actions">
          <HeaderControls />
          <Link
            href="/account/password"
            className="logout-btn"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            {t("pw_title")}
          </Link>
          <button className="logout-btn" onClick={logout}>
            {t("dash_logout")}
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="welcome-text">
            <h1>{t("dash_welcome").split(' ')[0]} <span>{t("dash_welcome").split(' ').slice(1).join(' ')}</span></h1>
            <p>{t("dash_subtitle")}</p>
          </div>
        </header>

        {profile.isExpired ? (
          <div className="dashboard-grid" style={{ display: "flex", justifyContent: "center" }}>
            <div className="dashboard-card" style={{ textAlign: "center", padding: "40px", maxWidth: "600px", margin: "0 auto", border: "1px solid var(--error)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "var(--error)", marginBottom: "16px" }}>warning</span>
              <h2 style={{ color: "var(--text)", marginBottom: "16px" }}>عذراً، انتهت صلاحية اشتراكك</h2>
              <p style={{ color: "var(--muted)", marginBottom: "32px", fontSize: "1.1rem" }}>
                لقد انتهت فترة الاشتراك الخاصة بك (30 يوماً). للحصول على خطة جديدة ومتابعة تدريبك، يرجى تجديد الاشتراك وتحديث بياناتك (مثل الوزن الحالي والصور الجديدة).
              </p>
              <Link href={`/form?renew=true&profileId=${profile.id}`} className="hero-btn primary-btn" style={{ textDecoration: "none", display: "inline-block" }}>
                تجديد الاشتراك وتحديث البيانات
              </Link>
            </div>
          </div>
        ) : (
          <div className="dashboard-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <ProfileStats profile={profile} />
              <UserAnswers profile={profile} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <WorkoutPlan profile={profile} />

              <RestDays profile={profile} />

              <div className="dashboard-card">
                <div className="dashboard-card-title">
                  {t("dash_sec_diet")}
                  <span className="pill-badge" style={{ fontSize: "14px", padding: "6px 12px" }}>
                    {profile.dietCalories} {t("dash_calories")}
                  </span>
                </div>
                <WaterTracker />
                <DietPlan profile={profile} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
