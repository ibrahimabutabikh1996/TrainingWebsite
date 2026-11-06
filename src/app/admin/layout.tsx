"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import "./admin.css";
import "./mode-switch.css";
import { Icon, type IconName } from "@/components/Icon";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { optimizedSrc, optimizedSrcSet } from "@/lib/imageOptim";
import { hasPermission, type StaffSection } from "@/lib/staffPermissions";
import { Dumbbell, Store } from "lucide-react";

/* Whether the desktop sidebar is folded down to its icons. Kept in this
   browser's storage so it stays folded across pages and reloads; read through
   `useSyncExternalStore` so the server renders it open and hydration switches
   it without an extra render. Storage can be unavailable (a private window,
   blocked site data), so the choice also lives in memory for the session. */
const COLLAPSE_KEY = "admin-nav-collapsed";
const COLLAPSE_EVENT = "admin-nav-collapse";
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

/* The sidebar's sections, in the order they are drawn. A heading is drawn only
   over a group this person has at least one item in. */
type NavGroup = "home" | "training" | "diet" | "admin" | "store_sales" | "store_catalog" | "store_admin";
const GYM_NAV_GROUPS: { id: NavGroup; title: string }[] = [
  { id: "home", title: "الرئيسية" },
  { id: "training", title: "التمارين" },
  { id: "diet", title: "الأنظمة الغذائية" },
  { id: "admin", title: "الإدارة" },
];
/* The supplements store is a second panel in the same shell: under
   /admin/store the sidebar swaps to the store's sections, and a switch at the
   top of it moves between the two. The coach's alone. */
const STORE_NAV_GROUPS: { id: NavGroup; title: string }[] = [
  { id: "store_sales", title: "المبيعات" },
  { id: "store_catalog", title: "المنتجات والمخزن" },
  { id: "store_admin", title: "الإعدادات" },
];
const STORE_PREFIX = "/admin/store";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { logout } = useAuth();

  /* The phone's "more" sheet. Dismissed by the scrim drawn behind it, or by
     choosing anything inside it. */
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isCollapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  /* The width animates only once the toggle has been pressed — not when a
     stored choice is applied on load, where it would read as the page
     jumping. */
  const [animateNav, setAnimateNav] = useState(false);
  const toggleCollapsed = () => {
    setAnimateNav(true);
    writeCollapsed(!isCollapsed);
  };

  /* Who is looking, so the bar draws only what they may open. Drawing only:
     every screen behind these links checks for itself on the server. Null
     until answered, and nothing is drawn meanwhile — a staff member must not
     see, even for a moment, a section they were not given. */
  const [access, setAccess] = useState<{ isOwner: boolean; permissions: string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAccess(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /* Challenge submissions waiting on a review — the number on the "التحديات"
     link. Read again on every page change, once a minute while the tab is in
     front, and when the challenges screen says it reviewed one. */
  const canSeeChallenges =
    access !== null && (access.isOwner || hasPermission(access.permissions, "challenges.view"));
  const [pendingChallenges, setPendingChallenges] = useState(0);
  useEffect(() => {
    if (!canSeeChallenges) return;
    let cancelled = false;
    const load = () => {
      fetch("/api/challenges/pending")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data && typeof data.pending === "number") setPendingChallenges(data.pending);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    window.addEventListener("challenges-changed", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("challenges-changed", load);
    };
  }, [canSeeChallenges, pathname]);
  const challengeBadge = (path: string) =>
    path === "/admin/challenges" && pendingChallenges > 0 ? (
      <span
        aria-label={`${pendingChallenges} طلب بانتظار المراجعة`}
        style={{ position: "absolute", top: "-6px", insetInlineEnd: "-8px", minWidth: "18px", height: "18px", padding: "0 5px", borderRadius: "var(--radius-pill)", background: "var(--error)", color: "var(--text-inverse)", fontSize: "11px", fontWeight: 700, lineHeight: "18px", textAlign: "center" }}
      >
        {pendingChallenges > 99 ? "99+" : pendingChallenges}
      </span>
    ) : null;

  /* `short` is the label under the icon in the phone tab bar. An item with no
     `section` is the coach's alone — no grant opens it. */
  const isStoreMode = pathname === STORE_PREFIX || pathname.startsWith(`${STORE_PREFIX}/`);
  const NAV_GROUPS = isStoreMode ? STORE_NAV_GROUPS : GYM_NAV_GROUPS;
  const storeNavItems: { name: string; short: string; path: string; icon: IconName; group: NavGroup; section?: StaffSection; edit?: true }[] = [
    /* In group order: the first four are the phone's tabs. */
    { name: "لوحة المتجر", short: "اللوحة", path: "/admin/store", icon: "monitoring", group: "store_sales" },
    { name: "الطلبات", short: "الطلبات", path: "/admin/store/orders", icon: "receipt_long", group: "store_sales" },
    { name: "الزبائن", short: "الزبائن", path: "/admin/store/customers", icon: "group", group: "store_sales" },
    { name: "المنتجات", short: "المنتجات", path: "/admin/store/products", icon: "inventory_2", group: "store_catalog" },
    { name: "المخزن", short: "المخزن", path: "/admin/store/inventory", icon: "layers", group: "store_catalog" },
    { name: "إعدادات المتجر", short: "الإعدادات", path: "/admin/store/settings", icon: "settings", group: "store_admin" },
  ];
  const gymNavItems: { name: string; short: string; path: string; icon: IconName; group: NavGroup; section?: StaffSection; edit?: true }[] = [
    /* Home: where the day starts. Overview and Analytics are the coach's alone;
       a staff member with the subscribers grant sees the list here. */
    { name: "نظرة عامة", short: "الرئيسية", path: "/admin/overview", icon: "home", group: "home" },
    { name: "إدارة المشتركين", short: "المشتركين", path: "/admin", icon: "group", group: "home", section: "subscribers" },
    { name: "التحليلات", short: "التحليلات", path: "/admin/analytics", icon: "monitoring", group: "home" },
    { name: "مكتبة الكورسات", short: "الكورسات", path: "/admin/courses", icon: "library_big", group: "training", section: "courses" },
    { name: "صانع الكورسات", short: "الصانع", path: "/admin/builder", icon: "clipboard_pen", group: "training", section: "courses", edit: true },
    { name: "التمارين", short: "التمارين", path: "/admin/exercises", icon: "fitness_center", group: "training", section: "exercises" },
    { name: "التحديات", short: "التحديات", path: "/admin/challenges", icon: "emoji_events", group: "training", section: "challenges" },
    { name: "النظام الغذائي", short: "الغذائي", path: "/admin/diet", icon: "restaurant", group: "diet", section: "diet" },
    { name: "مكتبة الأنظمة الغذائية", short: "مكتبة الأنظمة", path: "/admin/diet/library", icon: "notebook_text", group: "diet", section: "diet" },
    { name: "محتوى الموقع", short: "المحتوى", path: "/admin/cms", icon: "app_window", group: "admin", section: "cms" },
    { name: "إدارة المشرفين", short: "المشرفين", path: "/admin/staff", icon: "verified_user", group: "admin" },
  ];
  const allNavItems = isStoreMode ? storeNavItems : gymNavItems;
  const navItems = allNavItems.filter(
    (item) =>
      access !== null &&
      (access.isOwner ||
        (item.section !== undefined &&
          hasPermission(access.permissions, `${item.section}.${item.edit ? "edit" : "view"}`)))
  );

  /* A phone tab bar has room for five targets. The first four sections get
     one each and the fifth is "more", which opens a sheet holding the rest
     and the account commands. Which sections overflow depends on what this
     person may open, so it is worked out from the filtered list. */
  const PHONE_TABS = 4;
  const overflowItems = navItems.slice(PHONE_TABS);
  const isOverflowActive = overflowItems.some((item) => item.path === pathname);

  return (
    <div
      className={`admin-layout-wrapper ${isCollapsed ? "is-nav-collapsed" : ""} ${animateNav ? "is-nav-animated" : ""}`}
      dir="rtl"
    >
      {/* One nav, two shapes: a glass sidebar on the inline-start edge above
          768px, and a PWA tab bar pinned to the bottom of a phone. First in
          source so it sits at the right of the flex row in RTL, and so the
          keyboard reaches it before the page. */}
      <nav className="admin-shell-nav" aria-label="أقسام لوحة التحكم">
        <div className="admin-shell-head">
          <Link
            href="/"
            title="العودة للصفحة الرئيسية"
            className="admin-shell-brand"
            aria-label="العودة للصفحة الرئيسية"
          >
            {/* The square mark, for the folded sidebar. */}
            <img
              className="admin-shell-brand-mark"
              src={optimizedSrc("/images/logo/vLogo.png", 128)}
              srcSet={optimizedSrcSet("/images/logo/vLogo.png", [96, 128])}
              sizes="40px"
              alt=""
              loading="lazy"
              decoding="async"
            />
            <img
              className="admin-shell-brand-full"
              /* 5170x824 for a 200x60 box: 184 KB on every admin page. The
                 landing page has asked for these same three widths since the
                 optimiser was introduced; the panel never did. */
              src={optimizedSrc("/images/logo/hLogo.png", 384)}
              srcSet={optimizedSrcSet("/images/logo/hLogo.png", [384, 640])}
              sizes="200px"
              alt="Ibrahim Abutabikh Logo"
              decoding="async"
            />
          </Link>

          <button
            type="button"
            onClick={toggleCollapsed}
            className="admin-shell-toggle"
            title={isCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
            aria-label={isCollapsed ? "توسيع القائمة" : "تصغير القائمة"}
            aria-expanded={!isCollapsed}
          >
            {/* The sidebar is on the right, so folding it moves its edge right. */}
            <Icon name={isCollapsed ? "chevron_left" : "chevron_right"} className="app-icon" />
          </button>
        </div>

        {/* Gym ⇄ store, as a two-part switch that shows both sides and lights
            the one you are in. The coach only; on a phone it is in the "more"
            sheet. */}
        {access?.isOwner && (
          <div className={`admin-mode-switch${isStoreMode ? " is-store" : ""}`} role="group" aria-label="الانتقال بين الجم والمتجر">
            <span className="admin-mode-switch-thumb" aria-hidden="true" />
            <Link
              href="/admin/overview"
              className={`admin-mode-switch-option${!isStoreMode ? " is-active" : ""}`}
              aria-current={!isStoreMode ? "true" : undefined}
              title="الجم: اللاعبين، الكورسات، التغذية"
            >
              <Dumbbell aria-hidden="true" />
              <span className="admin-mode-switch-label">الجم</span>
            </Link>
            <Link
              href={STORE_PREFIX}
              className={`admin-mode-switch-option${isStoreMode ? " is-active" : ""}`}
              aria-current={isStoreMode ? "true" : undefined}
              title="متجر المكملات"
            >
              <Store aria-hidden="true" />
              <span className="admin-mode-switch-label">المتجر</span>
            </Link>
          </div>
        )}

        <div className="admin-nav-container">
          {/* Each group is a heading over its links. On a phone the group box
              steps aside (`display: contents`) so the links stay one tab row,
              and the first four of the whole list are the four tabs. */}
          {NAV_GROUPS.map((group) => {
            const items = navItems.filter((item) => item.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id} className="admin-nav-group" role="group" aria-label={group.title}>
                <span className="admin-shell-eyebrow" aria-hidden="true">{group.title}</span>
                {items.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      title={item.name}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsMoreOpen(false)}
                      className={`admin-nav-link ${isActive ? "active" : ""} ${navItems.indexOf(item) >= PHONE_TABS ? "is-overflow" : ""}`}
                    >
                      <span className="admin-nav-icon" style={{ position: "relative" }}>
                        <Icon name={item.icon} className="app-icon" />
                        {challengeBadge(item.path)}
                      </span>
                      <span className="admin-nav-label">{item.name}</span>
                      <span className="admin-nav-short">{item.short}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}

          {/* The fifth tab on a phone. Lit when the page open is one of the
              sections it holds, so the bar always shows where you are. */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            aria-expanded={isMoreOpen}
            className={`admin-nav-link admin-nav-more ${isMoreOpen || isOverflowActive ? "active" : ""}`}
          >
            <span className="admin-nav-icon" style={{ position: "relative" }}>
              <Icon name="settings" className="app-icon" />
              {overflowItems.some((item) => item.path === "/admin/challenges") && challengeBadge("/admin/challenges")}
            </span>
            <span className="admin-nav-short">المزيد</span>
          </button>
        </div>

        {/* Shown outright on the sidebar — there is room, and two commands
            do not need a menu to hide in. On a phone they are in the sheet. */}
        <div className="admin-shell-footer">
          <Link href="/account/password" title="تغيير كلمة المرور" className="admin-nav-link">
            <span className="admin-nav-icon"><Icon name="lock_reset" className="app-icon" /></span>
            <span className="admin-nav-label">تغيير كلمة المرور</span>
          </Link>
          <button type="button" onClick={logout} title="تسجيل الخروج" className="admin-nav-link danger">
            <span className="admin-nav-icon"><Icon name="logout" className="app-icon" /></span>
            <span className="admin-nav-label">تسجيل الخروج</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="admin-main-content">{children}</main>

      {/* The phone's "more" sheet, and the catcher behind it. Siblings of the
          nav rather than children of it: the nav carries a `backdrop-filter`,
          which would make it the containing block for anything `fixed` inside
          it, and the scrim would cover the bar instead of the screen. */}
      {isMoreOpen && (
        <>
          <div className="admin-more-scrim" onClick={() => setIsMoreOpen(false)} />
          <div className="admin-more-sheet" role="menu">
            {/* The overflow under the same headings the sidebar uses. */}
            {NAV_GROUPS.map((group) => {
              const items = overflowItems.filter((item) => item.group === group.id);
              if (items.length === 0) return null;
              return (
                <div key={group.id} className="admin-more-group" role="group" aria-label={group.title}>
                  <span className="admin-more-heading" aria-hidden="true">{group.title}</span>
                  {items.map((item) => (
                    <Link
                      key={item.path}
                      href={item.path}
                      role="menuitem"
                      onClick={() => setIsMoreOpen(false)}
                      className={`admin-dropdown-item ${pathname === item.path ? "active" : ""}`}
                    >
                      <Icon name={item.icon} />
                      <span>{item.name}</span>
                      {item.path === "/admin/challenges" && pendingChallenges > 0 && (
                        <span style={{ marginInlineStart: "auto", minWidth: "20px", padding: "0 6px", borderRadius: "var(--radius-pill)", background: "var(--error)", color: "var(--text-inverse)", fontSize: "12px", fontWeight: 700, lineHeight: "20px", textAlign: "center" }}>
                          {pendingChallenges}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              );
            })}

            {overflowItems.length > 0 && <div className="admin-dropdown-divider"></div>}

            {access?.isOwner && (
              <Link
                href={isStoreMode ? "/admin/overview" : STORE_PREFIX}
                role="menuitem"
                className="admin-dropdown-item admin-dropdown-item--switch"
                onClick={() => setIsMoreOpen(false)}
              >
                {isStoreMode ? <Dumbbell aria-hidden="true" /> : <Store aria-hidden="true" />}
                <span>{isStoreMode ? "انتقل إلى الجم" : "انتقل إلى المتجر"}</span>
              </Link>
            )}

            <Link
              href="/"
              role="menuitem"
              className="admin-dropdown-item"
              onClick={() => setIsMoreOpen(false)}
            >
              <Icon name="home" />
              <span>الموقع الرئيسي</span>
            </Link>

            <Link
              href="/account/password"
              role="menuitem"
              className="admin-dropdown-item"
              onClick={() => setIsMoreOpen(false)}
            >
              <Icon name="lock_reset" />
              <span>تغيير كلمة المرور</span>
            </Link>

            <div className="admin-dropdown-divider"></div>

            <button
              role="menuitem"
              onClick={() => {
                setIsMoreOpen(false);
                logout();
              }}
              className="admin-dropdown-item danger"
            >
              <Icon name="logout" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </>
      )}

      {/* Every "are you sure?" in the panel comes out here, mounted once the
          way the root layout mounts the upload window. It draws nothing until
          `confirmDialog()` is called. Panel-only on purpose: all the callers
          are these screens, and mounting it here keeps crm.css out of the
          bundle the public pages ship. */}
      <ConfirmDialog />
    </div>
  );
}
