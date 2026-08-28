"use client";

import { t } from "@/lib/translations";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { isAdminUsername, useCurrentUsername } from "@/lib/clientSession";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TraineeProfileDetails } from "@/components/dashboard/TraineeProfileDetails";
import { WorkoutPlan } from "@/components/dashboard/WorkoutPlan";
import WeightLog from "@/components/dashboard/WeightLog";
import "./dashboard.css";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import type { JsonRecord } from "@/types";

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

  /* The coach's side of the conversation. A new programme, a new diet, a
     changed subscription date — this page is a client component reading
     `/api/profile`, so bringing it up to date is the reload it already has.
     Waits for a profile before it starts: there is nothing to be current about
     until the first fetch has landed. */
  useLiveRefresh({ scope: "me", enabled: !!profile }, reload);

  // Default active tab override (when null, defaults to profile if under review or home otherwise)
  const [activeTabOverride, setActiveTabOverride] = useState<TabId | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  /* The coach landing on the trainee dashboard is sent to their own panel.
     Cosmetic routing only — /admin is guarded by the proxy and by every page
     behind it. The username comes from the session hint cookie now; it used to
     be read from localStorage and compared against two hard-coded names, a
     second copy of the list in @/lib/adminUsernames. */
  const username = useCurrentUsername();
  useEffect(() => {
    if (isAdminUsername(username)) router.push("/admin");
  }, [username, router]);

  useEffect(() => {
    if (activeTabOverride === "home") {
      reload();
    }
  }, [activeTabOverride, reload]);

  if (loading) {
    return (
      <div className="dashboard-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <img
        src={optimizedSrc("/images/logo/vLogo.png", 384)}
        srcSet={optimizedSrcSet("/images/logo/vLogo.png", [256, 384])}
        sizes="180px"
        alt="Loading..."
        className="loading-vlogo"
      />
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

  /* Define the 4 tabs in exact order from Right to Left (in RTL mode) */
  const tabs: TabConfig[] = [
    { id: "settings", label: "المزيد", icon: "settings" },
    { id: "workout", label: "البرنامج التدريبي", icon: "fitness_center" },
    { id: "home", label: "الرئيسية", icon: "home" },
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

  /* A renewal already asked for and not yet decided.
   *
   * The trainee submitted the form, the server recorded the request, and their
   * dashboard went on showing the same "renew" button as before — so the only
   * honest reading available to them was that nothing had happened. The server
   * now refuses a second submission while one is open, which without this
   * would be a dead end they could not see the reason for.
   *
   * Read from `raw_answers`, which /api/profile already returns whole; the flag
   * is written by /api/submit-form and cleared by the coach's decision either
   * way. */
  const renewalPending = (profile.raw_answers as JsonRecord | undefined)?.renewal_pending === true;
  const renewalRequestedMonth = (profile.raw_answers as JsonRecord | undefined)?.renewal_requested_month;
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
      {/* Tap anywhere to dismiss the overflow menu.
          This has to live outside <nav>, not inside it beside the menu where it
          used to. The bar carries `transform: translateX(-50%)` and a
          `backdrop-filter`, and either of those makes it the containing block
          for a `position: fixed` descendant — so `inset: 0` resolved to the bar
          rather than to the viewport, and the full-screen catcher was really a
          318x66 patch lying on top of the bar's own buttons. Tapping the page
          did not close the menu, and tapping a sibling tab hit the catcher
          instead of the tab, which spent the tap closing the menu and went
          nowhere. Verified by hand before and after. */}
      {isMoreMenuOpen && (
        <div className="dash-menu-scrim" onClick={() => setIsMoreMenuOpen(false)} />
      )}

      {/* Bottom Navbar */}
      <nav className="dash-bottom-nav">

        {/* The brand, and the way back to the public site — first in source, so
            in RTL it sits at the right end of the pill, where the panel's own
            logo sits. The square mark rather than the horizontal lockup: this
            bar is a centred pill sized to its contents, and a 200px wordmark
            inside it would pull the icon row off centre on every screen.
            `.dash-brand-header` and `.dash-collapsed-logo-tile` were already in
            dashboard.css, phone size and all, with nothing rendering them. */}
        <Link
          href="/"
          title="العودة للصفحة الرئيسية"
          className="dash-brand-header dash-collapsed-logo-tile"
          aria-label="العودة للصفحة الرئيسية"
        >
          <img
            src={optimizedSrc("/images/logo/mainLogo.png", 96)}
            srcSet={optimizedSrcSet("/images/logo/mainLogo.png", [96, 128])}
            sizes="84px"
            alt="Ibrahim Abutabikh"
            decoding="async"
            style={{ width: "100%", height: "auto", maxHeight: "26px", objectFit: "contain", display: "block" }}
          />
        </Link>

        {/* Center Nav Links */}
        <div className="dash-nav-container" style={{ width: "100%", justifyContent: "space-around", maxWidth: "500px", margin: "0 auto" }}>
          {tabs.map((tab) => {
            let isTabWaiting = false;
            if (tab.id === "workout") isTabWaiting = isWorkoutUnderReview;
            else if (tab.id === "diet") isTabWaiting = isDietUnderReview;
            else if (tab.id === "history") isTabWaiting = isHistoryUnderReview;

            const isActive = activeTab === tab.id || (tab.id === "settings" && isMoreMenuOpen);

            if (tab.id === "settings") {
              return (
                <div key={tab.id} style={{ position: "relative" }}>
                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    title={tab.label}
                    className={`dash-nav-link ${isActive ? "active" : ""}`}
                  >
                    <Icon name={tab.icon} />
                  </button>
                  {isMoreMenuOpen && (
                    <>
                      <div
                        className="dash-more-menu"
                        /* The panel is `.custom-select-dropdown`, to the value:
                           same border, radius, shadow, 4px of padding and 2px
                           between rows. Every list that drops out of a control
                           in this product is drawn the same way. */
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          right: "50%",
                          transform: "translateX(50%)",
                          marginBottom: "12px",
                          background: "var(--bg2)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: "var(--radius-md)",
                          padding: "4px",
                          boxShadow: "var(--elev-2)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          minWidth: "180px",
                          zIndex: 100,
                          animation: "fadeUp 0.2s ease-out forwards"
                        }}
                      >
                        <button onClick={() => { setActiveTab("weight"); setIsMoreMenuOpen(false); }} className="dash-more-item">
                          <Icon name="monitor_weight" /> سجل الأوزان
                        </button>
                        <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />
                        <Link href="/account/password" className="dash-more-item">
                          <Icon name="lock" /> تغيير كلمة السر
                        </Link>
                        <button onClick={logout} className="dash-more-item danger">
                          <Icon name="logout" /> تسجيل الخروج
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMoreMenuOpen(false);
                }}
                title={tab.label}
                className={`dash-nav-link ${isActive ? "active" : ""}`}
              >
                <Icon name={tab.icon} />
                {isTabWaiting && (
                  <span
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      width: "8px",
                      height: "8px",
                      background: "var(--warning)",
                      borderRadius: "50%",
                      boxShadow: "0 0 0 2px var(--bg2)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="dashboard-main">

        {/* Shown whether or not the subscription has run out, because a renewal
            asked for on day 25 is just as pending as one asked for on day 31 —
            and in both cases the trainee needs to know their form arrived. */}
        {renewalPending && (
          <div style={{
            background: "linear-gradient(135deg, color-mix(in srgb, #F59E0B 16%, var(--bg2)), var(--bg2))",
            border: "1px solid color-mix(in srgb, #F59E0B 45%, var(--border))",
            borderInlineStart: "5px solid #F59E0B",
            borderRadius: "var(--radius-xl)",
            padding: "24px 28px",
            marginBottom: "28px",
            boxShadow: "0 8px 32px color-mix(in srgb, #F59E0B 12%, rgba(0, 0, 0, 0.35))",
            display: "flex",
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap"
          }}>
            <div style={{
              width: "52px",
              height: "52px",
              borderRadius: "var(--radius-xl)",
              background: "color-mix(in srgb, #F59E0B 20%, var(--bg3))",
              color: "#F59E0B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              flexShrink: 0
            }}>
              <Icon name="hourglass" />
            </div>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "1.3rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span>طلب التجديد قيد المراجعة</span>
                {typeof renewalRequestedMonth === "number" && (
                  <span style={{ fontSize: "0.78rem", background: "#F59E0B", color: "#1a1a1a", padding: "3px 10px", borderRadius: "var(--radius-pill)", fontWeight: 800 }}>
                    الشهر {renewalRequestedMonth}
                  </span>
                )}
              </h3>
              <p style={{ margin: 0, fontSize: "0.98rem", color: "var(--text-muted)", lineHeight: 1.65 }}>
                وصلت استمارتك ووصل الدفع إلى الكابتن إبراهيم، وهو الآن يراجعها. بمجرد الموافقة
                ستُضاف أيام الشهر الجديد إلى اشتراكك تلقائياً ويبدأ تجهيز برنامجك التدريبي
                والغذائي للشهر الجديد. <b>لا حاجة لإعادة إرسال الاستمارة.</b>
              </p>
            </div>
          </div>
        )}

        {/* Kept even while a request is pending: the amber card above explains
            what is happening next, this one explains what is true now — that
            the dashboard is read-only until the month is granted. Only the
            button inside it stands down, because the server refuses a second
            submission and a button that cannot work is worse than no button. */}
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
              {renewalPending ? (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 24px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg3)",
                  border: "1px dashed color-mix(in srgb, #F59E0B 55%, var(--border))",
                  color: "#F59E0B",
                  fontWeight: 800,
                  fontSize: "0.98rem"
                }}>
                  <Icon name="hourglass" style={{ fontSize: "22px" }} />
                  <span>طلبك مُرسل — بانتظار موافقة الكابتن</span>
                </span>
              ) : (
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
              )}
            </div>
          </div>
        )}




        {/* Tab: Weight Log */}
        <div style={{ display: activeTab === "weight" ? "block" : "none" }}>
          <WeightLog profile={profile} onSaveSuccess={reload} />
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
                {/* Hero Greeting Text */}
                <div style={{ marginBottom: "var(--space-8)" }}>
                  <h2 className="dash-section-heading">
                    هلا بيك كابتن، <span style={{ color: "var(--primary)" }}>{profile.fullname}</span>!
                  </h2>
                </div>

                {/* Main Stats Row: Workouts Counter & Subscription Timeline */}
                <div className="home-stats-grid">
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

