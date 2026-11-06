"use client";

import { t } from "@/lib/translations";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useLiveRefresh } from "@/hooks/useLiveRefresh";
import { isAdminUsername, useCurrentUsername } from "@/lib/clientSession";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { TraineeProfileDetails } from "@/components/dashboard/TraineeProfileDetails";
import { WorkoutPlan } from "@/components/dashboard/WorkoutPlan";
import { DietPlan } from "@/components/dashboard/DietPlan";
import { TrainingCalendarCard } from "@/components/dashboard/TrainingCalendarMonth";
import WeightLog from "@/components/dashboard/WeightLog";
import Challenges from "@/components/dashboard/Challenges";
import "./dashboard.css";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import type { JsonRecord } from "@/types";

type TabId = "settings" | "weight" | "workout" | "home" | "diet" | "history" | "profile" | "challenges";

interface TabConfig {
  id: TabId;
  label: string;
  /** The label under the icon in the phone tab bar, where five full titles
      will not fit side by side. */
  short: string;
  icon: IconName;
}

/* Whether the desktop sidebar is folded down to its icons. Kept in this
   browser's storage so it stays folded across reloads; read through
   `useSyncExternalStore` so the server renders it open and hydration switches
   it without an extra render. Storage can be unavailable (a private window,
   blocked site data), so the choice also lives in memory for the session. */
const COLLAPSE_KEY = "dash-nav-collapsed";
const COLLAPSE_EVENT = "dash-nav-collapse";
let collapsedInMemory = false;

function readCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored !== null) return stored === "1";
  } catch {}
  return collapsedInMemory;
}

function writeCollapsed(value: boolean) {
  collapsedInMemory = value;
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export default function DashboardPage() {
  const { logout } = useAuth();
  const { profile, loading, error, reload } = useProfile();
  const router = useRouter();

  /* The training calendar reads its own endpoint rather than `/api/profile`,
     which carries no record of the days trained. This is how it is told to read
     again: bumped when the live poller sees a change, and when the home tab is
     opened — so a workout just filed on the workout tab is marked here. */
  const [calendarReloadKey, setCalendarReloadKey] = useState(0);

  /* The coach's side of the conversation. A new programme, a new diet, a
     changed subscription date — this page is a client component reading
     `/api/profile`, so bringing it up to date is the reload it already has.
     Waits for a profile before it starts: there is nothing to be current about
     until the first fetch has landed. */
  useLiveRefresh({ scope: "me", enabled: !!profile }, () => {
    reload();
    setCalendarReloadKey((k) => k + 1);
  });

  // Default active tab override (when null, defaults to profile if under review or home otherwise)
  const [activeTabOverride, setActiveTabOverride] = useState<TabId | null>(null);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const isNavCollapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  /* The width animates only once the toggle has been pressed — not when a
     stored choice is applied on load, where it would read as the page
     jumping. */
  const [animateNav, setAnimateNav] = useState(false);
  const toggleNavCollapsed = () => {
    setAnimateNav(true);
    writeCollapsed(!isNavCollapsed);
  };

  /* The coach landing on the trainee dashboard is sent to their own panel.
     Cosmetic routing only — /admin is guarded by the proxy and by every page
     behind it. The username comes from the session hint cookie now; it used to
     be read from localStorage and compared against two hard-coded names, a
     second copy of the list in @/lib/adminUsernames. */
  const username = useCurrentUsername();
  useEffect(() => {
    if (isAdminUsername(username)) router.push("/admin/overview");
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
        <p style={{ fontSize: "1.1rem", fontWeight: 500, color: "var(--error-text)" }}>{error || "لم يتم العثور على الملف"}</p>
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
  const setActiveTab = (tab: TabId) => {
    setActiveTabOverride(tab);
    /* Coming back to the home tab is when its calendar has to be current — a
       workout may have just been filed on the workout tab. Bumped here rather
       than in the effect beside `reload()`, which may not call setState. */
    if (tab === "home") setCalendarReloadKey((k) => k + 1);
  };

  /* The tabs in order — top to bottom in the sidebar, right to left in the
     phone tab bar. */
  const tabs: TabConfig[] = [
    { id: "home", label: "الرئيسية", short: "الرئيسية", icon: "home" },
    { id: "profile", label: "الملف الشخصي", short: "ملفي", icon: "person" },
    { id: "workout", label: "البرنامج التدريبي", short: "التمارين", icon: "fitness_center" },
    { id: "diet", label: "النظام الغذائي", short: "الغذاء", icon: "restaurant" },
    { id: "weight", label: "سجل الأوزان", short: "الأوزان", icon: "monitor_weight" },
    { id: "challenges", label: "التحديات", short: "التحديات", icon: "emoji_events" },
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
    <div
      className={`dashboard-page dashboard-page--shell ${isNavCollapsed ? "is-nav-collapsed" : ""} ${animateNav ? "is-nav-animated" : ""}`}
    >
      {/* Tap anywhere to dismiss the settings menu.
          This has to live outside the bar, not inside it beside the menu. The
          bar carries a `backdrop-filter`, which makes it the containing block
          for a `position: fixed` descendant — so `inset: 0` resolved to the bar
          rather than to the viewport, and the full-screen catcher was really a
          patch lying on top of the bar's own buttons. */}
      {isMoreMenuOpen && (
        <div className="dash-menu-scrim" onClick={() => setIsMoreMenuOpen(false)} />
      )}

      {/* Phone top bar — the brand and the settings menu. Above 768px it is
          not drawn: the sidebar carries both. */}
      <header className="dash-topbar">
        <Link
          href="/"
          title="العودة للصفحة الرئيسية"
          className="dash-topbar-brand"
          aria-label="العودة للصفحة الرئيسية"
        >
          <img
            src={optimizedSrc("/images/logo/vLogo.png", 128)}
            srcSet={optimizedSrcSet("/images/logo/vLogo.png", [96, 128])}
            sizes="60px"
            alt="Ibrahim Abutabikh"
            decoding="async"
          />
        </Link>

        <div className="dash-topbar-actions">
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            title="الإعدادات"
            aria-label="الإعدادات"
            aria-expanded={isMoreMenuOpen}
            className={`dash-icon-btn ${isMoreMenuOpen ? "active" : ""}`}
          >
            <Icon name="settings" />
          </button>
          {isMoreMenuOpen && (
            <div className="dash-more-menu">
              <Link href="/account/password" className="dash-more-item">
                <Icon name="lock" /> تغيير كلمة السر
              </Link>
              <button onClick={logout} className="dash-more-item danger">
                <Icon name="logout" /> تسجيل الخروج
              </button>
            </div>
          )}
        </div>
      </header>

      {/* One nav, two shapes: a glass sidebar on the inline-start edge above
          768px, and a PWA tab bar pinned to the bottom of a phone. The same
          buttons in both — only which label shows, and where the row sits,
          changes with the width. */}
      <nav className="dash-nav" aria-label="أقسام لوحة المشترك">
        <div className="dash-nav-head">
          <Link
            href="/"
            title="العودة للصفحة الرئيسية"
            className="dash-nav-brand"
            aria-label="العودة للصفحة الرئيسية"
          >
            {/* The square mark, for the folded sidebar. */}
            <img
              className="dash-nav-brand-mark"
              src={optimizedSrc("/images/logo/vLogo.png", 128)}
              srcSet={optimizedSrcSet("/images/logo/vLogo.png", [96, 128])}
              sizes="40px"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <img
              className="dash-nav-brand-full"
              src={optimizedSrc("/images/logo/hLogo.png", 384)}
              srcSet={optimizedSrcSet("/images/logo/hLogo.png", [384, 640])}
              sizes="190px"
              alt="Ibrahim Abutabikh"
              decoding="async"
            />
          </Link>

          <button
            type="button"
            onClick={toggleNavCollapsed}
            className="dash-nav-toggle"
            title={isNavCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
            aria-label={isNavCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
            aria-expanded={!isNavCollapsed}
          >
            {/* The sidebar is on the right, so folding it moves its edge right. */}
            <Icon name={isNavCollapsed ? "chevron_left" : "chevron_right"} />
          </button>
        </div>

        <span className="dash-nav-eyebrow">القائمة</span>

        <div className="dash-nav-list">
          {tabs.map((tab) => {
            let isTabWaiting = false;
            if (tab.id === "workout") isTabWaiting = isWorkoutUnderReview;
            else if (tab.id === "diet") isTabWaiting = isDietUnderReview;
            else if (tab.id === "history") isTabWaiting = isHistoryUnderReview;

            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsMoreMenuOpen(false);
                }}
                title={tab.label}
                aria-current={isActive ? "page" : undefined}
                className={`dash-nav-link ${isActive ? "active" : ""}`}
              >
                <span className="dash-nav-icon">
                  <Icon name={tab.icon} />
                  {isTabWaiting && <span className="dash-nav-dot" aria-hidden="true" />}
                </span>
                <span className="dash-nav-label">{tab.label}</span>
                <span className="dash-nav-short">{tab.short}</span>
              </button>
            );
          })}
        </div>

        {/* Shown outright on the sidebar — there is room, and two commands do
            not need a menu to hide in. On a phone they live in the top bar. */}
        <div className="dash-nav-footer">
          <Link href="/account/password" title="تغيير كلمة السر" className="dash-nav-link">
            <span className="dash-nav-icon"><Icon name="lock" /></span>
            <span className="dash-nav-label">تغيير كلمة السر</span>
          </Link>
          <button type="button" onClick={logout} title="تسجيل الخروج" className="dash-nav-link danger">
            <span className="dash-nav-icon"><Icon name="logout" /></span>
            <span className="dash-nav-label">تسجيل الخروج</span>
          </button>
        </div>
      </nav>

      <main className="dashboard-main">

        {/* Shown whether or not the subscription has run out, because a renewal
            asked for on day 25 is just as pending as one asked for on day 31 —
            and in both cases the trainee needs to know their form arrived. */}
        {renewalPending && (
          <div className="ui-alert ui-alert--warning" style={{
            padding: "24px 28px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "flex-start",
            gap: "18px",
            flexWrap: "wrap"
          }}>
            <div className="ui-icon-tile ui-icon-tile--lg ui-icon-tile--lit tone-warning">
              <Icon name="hourglass" />
            </div>
            <div style={{ flex: "1 1 320px", minWidth: 0 }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "1.3rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span>طلب التجديد قيد المراجعة</span>
                {typeof renewalRequestedMonth === "number" && (
                  <span className="ui-badge tone-warning">
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
          <div className="ui-alert ui-alert--danger" style={{
            padding: "24px 28px",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "18px", maxWidth: "700px" }}>
              <div className="ui-icon-tile ui-icon-tile--lg ui-icon-tile--lit tone-danger">
                <Icon name="lock" />
              </div>
              <div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.35rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span>انتهت صلاحية اشتراكك الحالي</span>
                  <span className="ui-badge tone-danger">وضع المعاينة فقط (View Only)</span>
                </h3>
                <p style={{ margin: "0", fontSize: "0.98rem", color: "var(--text-muted)", lineHeight: 1.65 }}>
                  لقد وصلت إلى نهاية فترة اشتراكك التدريبي (30 يوماً). جميع التمارين، الأوزان، والجداول متاحة الآن <b>للمعاينة والمراجعة فقط</b> ولا يمكن التعديل عليها أو إضافة أرقام جديدة. لاستكمال تدريبك والحصول على خطة جديدة، يُرجى تجديد الاشتراك.
                </p>
              </div>
            </div>
            <div>
              {renewalPending ? (
                <span className="ui-alert ui-alert--warning" style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "14px 24px",
                  fontWeight: 800,
                  fontSize: "0.98rem"
                }}>
                  <Icon name="hourglass" style={{ fontSize: "22px" }} />
                  <span>طلبك مُرسل — بانتظار موافقة الكابتن</span>
                </span>
              ) : (
              <Link
                href={`/form?renew=true&profileId=${profile.id}`}
                className="dash-primary-btn ui-btn--danger"
                style={{
                  padding: "14px 28px",
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                <Icon name="lock_reset" style={{ fontSize: "24px" }} />
                <span>تجديد الاشتراك وتحديث البيانات</span>
              </Link>
              )}
            </div>
          </div>
        )}




        {/* Tab: Challenges — reads its own endpoint; the live poller bumps the key. */}
        <div style={{ display: activeTab === "challenges" ? "block" : "none" }}>
          <Challenges reloadKey={calendarReloadKey} />
        </div>

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

        {/* Tab: Diet Plan */}
        <div style={{ display: activeTab === "diet" ? "block" : "none" }}>
          {isDietUnderReview ? renderProcessingCard("النظام الغذائي") : (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <DietPlan profile={profile} />
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
                        <span className="ui-badge tone-danger">
                          <Icon name="warning" style={{ fontSize: "14px" }} /> منتهي الصلاحية (معاينة فقط)
                        </span>
                      ) : (
                        <span className="ui-badge tone-success">
                          <Icon name="check_circle" style={{ fontSize: "14px" }} /> الحساب فعال
                        </span>
                      )}
                    </div>
                  </div>

                  {/* The days the trainee has trained on, marked automatically.
                      Read-only here — the day a workout is filed under is chosen
                      on the workout tab, and shows up here once it is. */}
                  <TrainingCalendarCard
                    profileId={profile.id}
                    reloadKey={calendarReloadKey}
                  />
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

