"use client";

import { HeaderControls } from "@/components/HeaderControls";
import { t } from "@/lib/translations";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DietPlan } from "@/components/dashboard/DietPlan";
import { TraineeProfileDetails } from "@/components/dashboard/TraineeProfileDetails";
import { WorkoutPlan } from "@/components/dashboard/WorkoutPlan";
import { SubscriptionCalendar } from "@/components/dashboard/SubscriptionCalendar";
import { SubscriptionHistoryTimeline } from "@/components/dashboard/SubscriptionHistoryTimeline";
import WeightLog from "@/components/dashboard/WeightLog";
import "./dashboard.css";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";

type TabId = "settings" | "weight" | "workout" | "home" | "diet" | "history" | "profile";

interface TabConfig {
  id: TabId;
  label: string;
  icon: IconName;
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const { profile, loading, error, reload } = useProfile();
  const router = useRouter();

  // Default active tab override (when null, defaults to profile if under review or home otherwise)
  const [activeTabOverride, setActiveTabOverride] = useState<TabId | null>(null);

  useEffect(() => {
    if (localStorage.getItem("loggedInUsername") === "admin" || localStorage.getItem("loggedInUsername") === "mkm94admin") {
      router.push("/admin");
    }
  }, [router]);

  useEffect(() => {
    if (activeTabOverride === "home") {
      reload();
    }
  }, [activeTabOverride, reload]);

  if (loading) {
    return (
      <div className="dashboard-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <img src="/images/logo/vLogo.png" alt="Loading..." className="loading-vlogo" />
          <p style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--muted2)", margin: 0 }}>{t("dash_checking_db")}</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="dashboard-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--error)" }}>{error || "لم يتم العثور على الملف"}</p>
      </div>
    );
  }

  const isWorkoutUnderReview = Boolean(!profile.workouts || profile.workouts.length === 0);
  const isDietUnderReview = Boolean(
    (!profile.dietPlans || profile.dietPlans.length === 0) &&
    profile.meals?.breakfast?.time === "غير محدد"
  );
  const isFullyUnderReview = Boolean(isWorkoutUnderReview && isDietUnderReview);
  const isHomeUnderReview = Boolean(isFullyUnderReview);
  const isHistoryUnderReview = Boolean(
    isFullyUnderReview && (!profile.monthlyHistory || profile.monthlyHistory.length === 0)
  );

  const activeTab: TabId = activeTabOverride ?? (isFullyUnderReview ? "profile" : "home");
  const setActiveTab = (tab: TabId) => setActiveTabOverride(tab);

  /* Define the 6 tabs in exact order from Right to Left (in RTL mode) */
  const tabs: TabConfig[] = [
    { id: "settings", label: "الإعدادات", icon: "build" },
    { id: "workout", label: "البرنامج التدريبي", icon: "fitness_center" },
    { id: "home", label: "الرئيسية", icon: "home" },
    { id: "diet", label: "النظام الغذائي", icon: "restaurant" },
    { id: "history", label: "السجل التاريخي", icon: "calendar_month" },
    { id: "profile", label: "الملف الشخصي", icon: "person" },
  ];

  const renderProcessingCard = (tabTitle: string) => (
    <div className="dashboard-grid" style={{ display: "flex", justifyContent: "center", paddingTop: "12px" }}>
      <div className="processing-card" style={{ width: "100%", maxWidth: "700px" }}>
        <div className="processing-content">
          <div className="processing-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 22h14" />
              <path d="M5 2h14" />
              <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
              <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
            </svg>
          </div>
          <h2 className="processing-title">{tabTitle} (قيد التجهيز)</h2>
          <p className="processing-text">
            مرحباً بك يا بطل! تم حفظ جميع معلوماتك وبيانات اشتراكك بنجاح ويمكنك الاطلاع عليها كاملة من خلال تبويب <b>(الملف الشخصي)</b>.<br />
            الكابتن إبراهيم يقوم الآن بمراجعة ملفك وتجهيز الجداول المخصصة لك بدقة.<br />
            يرجى الانتظار، سيتم تفعيل الخطة وتحديث هذا القسم قريباً.
          </p>
          <button onClick={() => window.location.reload()} className="processing-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            تحديث الصفحة
          </button>
        </div>
      </div>
    </div>
  );

  /* Date and progress calculations for Home tab */
  const now = new Date();
  const startDate = profile.activation_date ? new Date(profile.activation_date) : (profile.created_at ? new Date(profile.created_at) : new Date());
  const endDate = profile.subscription_ends_at ? new Date(profile.subscription_ends_at) : new Date(startDate.getTime() + 30 * 86400000);
  const isSubscriptionExpired = Boolean(profile.isExpired || (profile.subscription_ends_at && new Date(profile.subscription_ends_at).getTime() <= now.getTime()));
  const totalDays = Math.max(30, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((now.getTime() - startDate.getTime()) / 86400000)));
  const remainingDays = isSubscriptionExpired ? 0 : Math.max(0, Math.round((endDate.getTime() - now.getTime()) / 86400000));
  const progressPercent = isSubscriptionExpired ? 100 : Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  const formatDate = (date: Date) => {
    try {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return date.toISOString().slice(0, 10);
    }
  };

  return (
    <div className="dashboard-page">
      {/* Top Glass Navbar */}
      <header className="top-bar">
        <Link href="/" className="image-logo" title="العودة للصفحة الرئيسية">
          <div className="image-logo-mark" style={{ height: "48px", maxWidth: "280px" }}>
            <img 
              src="/images/logo/hLogo.png" 
              alt="Ibrahim Abutabikh Logo" 
              style={{ maxHeight: "48px", height: "100%", width: "auto", maxWidth: "100%", objectFit: "contain" }} 
            />
          </div>
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
        <header className="dashboard-header" style={{ marginBottom: 24 }}>
          <div className="welcome-text">
            <h1>{t("dash_welcome").split(' ')[0]} <span>{t("dash_welcome").split(' ').slice(1).join(' ')}</span></h1>
          </div>
        </header>

        {isSubscriptionExpired && (
          <div style={{
            background: "linear-gradient(135deg, color-mix(in srgb, #EF4444 16%, var(--bg2)), var(--bg2))",
            border: "1px solid color-mix(in srgb, #EF4444 45%, var(--border))",
            borderInlineStart: "5px solid #EF4444",
            borderRadius: "var(--radius-xl)",
            padding: "24px 28px",
            marginBottom: "28px",
            boxShadow: "0 8px 32px color-mix(in srgb, #EF4444 12%, rgba(0, 0, 0, 0.35))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "18px", maxWidth: "700px" }}>
              <div style={{
                width: "52px",
                height: "52px",
                borderRadius: "var(--radius-xl)",
                background: "color-mix(in srgb, #EF4444 20%, var(--bg3))",
                color: "#EF4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "30px",
                flexShrink: 0,
                boxShadow: "0 4px 14px color-mix(in srgb, #EF4444 25%, transparent)"
              }}>
                <Icon name="lock" />
              </div>
              <div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.35rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span>انتهت صلاحية اشتراكك الحالي</span>
                  <span style={{ fontSize: "0.78rem", background: "#EF4444", color: "#fff", padding: "3px 10px", borderRadius: "var(--radius-pill)", fontWeight: 700 }}>وضع المعاينة فقط (View Only)</span>
                </h3>
                <p style={{ margin: "0", fontSize: "0.98rem", color: "var(--text-muted)", lineHeight: 1.65 }}>
                  لقد وصلت إلى نهاية فترة اشتراكك التدريبي (30 يوماً). جميع التمارين، الأوزان، والجداول متاحة الآن <b>للمعاينة والمراجعة فقط</b> ولا يمكن التعديل عليها أو إضافة أرقام جديدة. لاستكمال تدريبك والحصول على خطة جديدة، يُرجى تجديد الاشتراك.
                </p>
              </div>
            </div>
            <div>
              <Link
                href={`/form?renew=true&profileId=${profile.id}`}
                className="dash-primary-btn"
                style={{
                  background: "#EF4444",
                  color: "#FFFFFF",
                  padding: "14px 28px",
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  borderRadius: "var(--radius-lg)",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  boxShadow: "0 6px 24px color-mix(in srgb, #EF4444 45%, transparent)"
                }}
              >
                <Icon name="lock_reset" style={{ fontSize: "24px" }} />
                <span>تجديد الاشتراك وتحديث البيانات</span>
              </Link>
            </div>
          </div>
        )}

        {/* Horizontal 5-Tab Navigation Bar */}
        <div className="dash-tabs-wrapper">
          <nav className="dash-tabs-bar" role="tablist">
            {tabs.map((tab) => {
              let isTabWaiting = false;
              if (tab.id === "workout") isTabWaiting = isWorkoutUnderReview;
              else if (tab.id === "diet") isTabWaiting = isDietUnderReview;
              else if (tab.id === "home") isTabWaiting = isHomeUnderReview;
              else if (tab.id === "history") isTabWaiting = isHistoryUnderReview;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`dash-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  title={tab.label}
                >
                  <span className="dash-tab-icon"><Icon name={tab.icon} /></span>
                  <span className="dash-tab-text">
                    {tab.label}
                    {isTabWaiting && (
                      <span
                        title="هذا القسم قيد المراجعة والتجهيز من قبل الكابتن إبراهيم"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--primary-transparent, rgba(201,168,76,0.18))",
                          color: "var(--primary, #C9A84C)",
                          border: "1px solid var(--border-gold, rgba(201,168,76,0.30))",
                          width: "26px",
                          height: "26px",
                          borderRadius: "50%",
                          marginInlineStart: "8px",
                          boxShadow: "0 0 10px rgba(201,168,76,0.25)",
                        }}
                      >
                        <Icon name="hourglass" style={{ fontSize: "15px" }} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

            {/* Tab 1: Settings (Right) */}
            <div style={{ display: activeTab === "settings" ? "block" : "none" }}>
              <div className="home-overview-container" style={{ maxWidth: 800 }}>
                <div className="home-hero-banner">
                  <div className="home-hero-text">
                    <h2>إعدادات الحساب والأمان</h2>
                    <p>إدارة الحساب الشخصي، تبديل المظهر العام والتفضيلات، أو التناوب على إدارة الجلسة.</p>
                  </div>
                  <Icon name="build" style={{ fontSize: "56px", color: "var(--primary)", flexShrink: 0 }} />
                </div>

                <div className="home-stat-card" style={{ padding: 32, gap: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", color: "var(--text)" }}>تعديل كلمة المرور</h3>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>تحديث كلمة المرور الخاصة بحسابك للأمان والخصوصية</p>
                    </div>
                    <Link href="/account/password" className="hero-btn primary-btn" style={{ textDecoration: "none" }}>
                      تغيير كلمة المرور
                    </Link>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", color: "var(--text)" }}>تفضيلات المظهر واللغة</h3>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>التبديل بين الوضع الداكن والفاتح أو اختيار لغة الواجهة</p>
                    </div>
                    <HeaderControls />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", color: "var(--error, #e53935)" }}>تسجيل الخروج من الجلسة</h3>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>الخروج من الحساب الحالي على هذا المتصفح</p>
                    </div>
                    <button onClick={logout} className="logout-btn" style={{ padding: "12px 24px", fontSize: "1rem", borderColor: "var(--error, #e53935)", color: "var(--error, #e53935)" }}>
                      تسجيل الخروج
                    </button>
                  </div>
                </div>
              </div>
            </div>

        {/* Tab: Weight Log */}
        <div style={{ display: activeTab === "weight" ? "block" : "none" }}>
          <WeightLog profile={profile} />
        </div>

        {/* Tab 2: Workout Program (Right) */}
        <div style={{ display: activeTab === "workout" ? "block" : "none" }}>
          {isWorkoutUnderReview ? renderProcessingCard("البرنامج التدريبي") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <WorkoutPlan profile={profile} />
            </div>
          )}
        </div>

        {/* Tab 3: Home / General Info & Stats (Center Default) */}
        <div style={{ display: activeTab === "home" ? "block" : "none" }}>
          {isHomeUnderReview ? renderProcessingCard("الرئيسية وملخص الإنجاز") : (
            <div className="home-overview-container">
                {/* Hero Greeting Banner */}
                <div className="home-hero-banner">
                  <div className="home-hero-text">
                    <h2>هلا بيك كابتن، {profile.fullname}!</h2>
                    <p>هنا تجد ملخص إنجازك البدني وحالة اشتراكك النشط في التدريب والمتابعة مع الكابتن إبراهيم. واصل الالتزام ببرنامجك الرياضي والغذائي لبلوغ هدفك!</p>
                  </div>
                  <div style={{ flexShrink: 0, opacity: 0.9 }}>
                    <Icon name="workspace_premium" style={{ fontSize: "72px", color: "var(--primary)" }} />
                  </div>
                </div>

                {/* Main Stats Row: Workouts Counter & Subscription Timeline */}
                <div className="home-stats-grid">
                  {/* Workout Days Accomplished Card */}
                  <div className="home-stat-card">
                    <div>
                      <div className="home-card-header">
                        <h3 className="home-card-title">إنجازك الرياضي التراكمي</h3>
                        <div className="home-card-icon"><Icon name="fitness_center" /></div>
                      </div>
                      <div className="home-workout-counter">
                        <span className="num">{profile.completedCycles ?? profile.completedWorkoutDays ?? 0}</span>
                        <span className="unit">دورة تدريبية مكتملة</span>
                      </div>
                      <p style={{ color: "var(--text-muted)", margin: "8px 0 0", fontSize: "0.92rem", lineHeight: "1.6" }}>
                        هذا الرقم يمثل إجمالي الدورات التدريبية المكتملة في سجلك الرياضي بنجاح. كل دورة تنجزها تقربك أكثر من النسخة الأفضل لك!
                      </p>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
                      <button 
                        onClick={() => setActiveTab("workout")} 
                        className="dash-primary-btn" 
                        style={{ width: "100%" }}
                      >
                        <Icon name="exercise" style={{ fontSize: "22px" }} />
                        <span>الذهاب للبرنامج التدريبي ومتابعة دورتك الحالية</span>
                      </button>
                    </div>
                  </div>

                  {/* Subscription Details & Progress Card */}
                  <div className="home-stat-card">
                    <div>
                      <div className="home-card-header">
                        <h3 className="home-card-title">معلومات الاشتراك</h3>
                        <div className="home-card-icon"><Icon name="calendar_month" /></div>
                      </div>
                      <div className="home-sub-details">
                        <div className="home-sub-item">
                          <span className="label">تاريخ بداية الاشتراك</span>
                          <span className="value">{formatDate(startDate)}</span>
                        </div>
                        <div className="home-sub-item">
                          <span className="label">تاريخ انتهاء الاشتراك</span>
                          <span className="value">{formatDate(endDate)}</span>
                        </div>
                      </div>
                      <div className="home-progress-container">
                        <div className="home-progress-meta">
                          <span>مضى: {elapsedDays} يوماً</span>
                          <span className="rem">المتبقي: {remainingDays} يوماً</span>
                        </div>
                        <div className="home-progress-bar-track">
                          <div className="home-progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                        تاريخ الاشتراك: {profile.created_at ? formatDate(new Date(profile.created_at)) : "مسجل"}
                      </span>
                      {isSubscriptionExpired ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: "700", color: "var(--error, #EF4444)", background: "color-mix(in srgb, var(--error, #EF4444) 15%, transparent)", padding: "4px 12px", borderRadius: "var(--radius-pill)" }}>
                          <Icon name="warning" style={{ fontSize: "14px" }} /> منتهي الصلاحية (معاينة فقط)
                        </span>
                      ) : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", fontWeight: "700", color: "var(--success, #10b981)", background: "color-mix(in srgb, var(--success, #10b981) 15%, transparent)", padding: "4px 12px", borderRadius: "var(--radius-pill)" }}>
                          <Icon name="check_circle" style={{ fontSize: "14px" }} /> الحساب فعال
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Monthly Commitment Calendar */}
              <SubscriptionCalendar 
                startDate={startDate} 
                endDate={endDate} 
                workoutDates={profile.workoutDates} 
              />
            </div>
          )}
        </div>

        {/* Tab 4: Diet Plan (Left) */}
        <div style={{ display: activeTab === "diet" ? "block" : "none" }}>
          {isDietUnderReview ? renderProcessingCard("النظام الغذائي") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <DietPlan profile={profile} />
            </div>
          )}
        </div>

        {/* Tab 5: Historical Record & Archive */}
        <div style={{ display: activeTab === "history" ? "block" : "none" }}>
          {isHistoryUnderReview ? renderProcessingCard("السجل التاريخي") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <SubscriptionHistoryTimeline profile={profile} />
            </div>
          )}
        </div>

        {/* Tab 6: Profile & Answers (Left) */}
        <div style={{ display: activeTab === "profile" ? "block" : "none" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <TraineeProfileDetails profile={profile} />
          </div>
        </div>
      </main>
    </div>
  );
}

