"use client";

import type { JsonRecord } from "@/types";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Profile } from "@/types/admin";
import { Toaster, toast } from "react-hot-toast";
import { PLAN_COLOUR_SLOT } from "@/lib/formLabels";
import { planNameFrom, planOptions, type PlanNames } from "@/lib/planNames";
import { planTagStyle } from "@/lib/planCards";
import { Icon } from "@/components/Icon";
import { CustomSelect } from "@/components/CustomSelect";
import { formatTimestamp } from "@/lib/trainingDates";
import "./crm.css";
import { normalizeArabic, arabicIncludes } from "@/lib/arabicSearch";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";

/* The intake blob, parsed. Older rows stored it as a string, newer ones as JSON.
   Lives outside the component: it reads nothing but its argument, and an effect
   near the top of the component used to call it before its declaration ran. */
function getProfileData(p: Profile): JsonRecord {
  if (typeof p.data === "string") {
    try {
      return JSON.parse(p.data);
    } catch {
      return {};
    }
  }
  return p.data || {};
}

/* One entry in the bell, flattened out of the trainee's `notifications`. */
type Notice = {
  id: string;
  profileId: string;
  name: string;
  type: "new" | "renewal";
  at: string;
  month?: number;
  plan: unknown;
  readAt: string | null;
};

/* The filter dropdowns here used to be a second `CustomSelect`, declared in
   this file and shadowing the shared one. It named six CSS classes and only one
   of them — the trigger — was ever written: `crm-select-dropdown`,
   `crm-select-option`, `crm-select-backdrop`, `crm-select-icon` and
   `crm-custom-select-container` have no rules anywhere in the project. So the
   button looked right and the opened list fell out of it as bare, unstyled
   HTML buttons laid out in a row.

   It also meant `CustomSelect.css` was never pulled into this route's bundle —
   /admin loaded three stylesheets, none of which contained a single dropdown
   rule, while /form got them and worked.

   Deleted in favour of @/components/CustomSelect, which every screen now uses —
   the native <select> elements that were scattered across the panel and the
   dashboard went the same way, so there is one dropdown in the project and one
   place to style it. */

export default function AdminCRMClient({
  initialProfiles,
  planNames,
}: {
  initialProfiles: Profile[];
  planNames: PlanNames;
}) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showNotifications, setShowNotifications] = useState(false);
  const [noticeFilter, setNoticeFilter] = useState<"unread" | "read" | "all">("unread");
  const [pageSize, setPageSize] = useState("20");
  const [page, setPage] = useState(1);

  /* Back to the first page whenever what the table shows changes — page 3 of
     a search that now has one page of results is an empty table. Taken over
     during render, the same pattern as `seenInitial` below. */
  const listKey = `${search}\u0000${filterPlan}\u0000${sortBy}\u0000${pageSize}`;
  const [seenListKey, setSeenListKey] = useState(listKey);
  if (listKey !== seenListKey) {
    setSeenListKey(listKey);
    setPage(1);
  }

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles || []);

  /* `LiveRefresh` re-runs the page and hands down a new list, but state seeded
     from a prop keeps its first value — so a subscriber or a renewal arriving
     while the panel was open never reached the bell. Taken over during render,
     React's pattern for state that follows a prop, rather than in an effect. */
  const [seenInitial, setSeenInitial] = useState(initialProfiles);
  if (initialProfiles !== seenInitial) {
    setSeenInitial(initialProfiles);
    setProfiles(initialProfiles || []);
  }

  const router = useRouter();

  /* The bell closes on Escape, as every other dialog in the panel does. */
  useEffect(() => {
    if (!showNotifications) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotifications(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showNotifications]);

  const handleSelectProfile = (profile: Profile) => {
    const url = `/admin/profile/${profile.id}`;
    /* Installed as an app, a new tab leaves it: on an iPhone it opens Safari,
       whose cookies are not the app's, so the coach landed on the sign-in
       screen instead of the trainee. The app opens the profile in place. */
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      router.push(url);
      return;
    }
    // Open in a new tab immediately
    window.open(url, '_blank');
  };

  /* The bell's "تم القراءة" button, and the only thing that marks an entry
     read — opening the trainee no longer does. The entry is stamped, not
     removed, so it moves to the "read" filter and stays there. */
  const handleMarkRead = async (notice: Notice) => {
    const readAt = new Date().toISOString();
    /* The row as it was, to put back if the server does not take the change. */
    const before = profiles.find(p => p.id === notice.profileId);
    setProfiles(prev => prev.map(p => {
      if (p.id !== notice.profileId) return p;
      const pData = getProfileData(p);
      const list = Array.isArray(pData.notifications)
        ? pData.notifications.map((n: JsonRecord) => (n && n.id === notice.id ? { ...n, read_at: readAt } : n))
        : [{ id: notice.id, type: notice.type, at: notice.at, read_at: readAt }];
      return { ...p, data: { ...pData, is_new: false, notifications: list } };
    }));

    try {
      const res = await fetch("/api/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notice.profileId, notificationId: notice.id })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("Failed to mark notification as read", err);
      if (before) setProfiles(prev => prev.map(p => (p.id === notice.profileId ? before : p)));
      toast.error("تعذّر تعليم الإشعار كمقروء، حاول مرة أخرى");
    }
  };

  /**
   * One field, ready to sit in a CSV.
   *
   * Two separate problems, both reached from the public registration form —
   * every value below except the dates is something a stranger typed.
   *
   * The quotes were not escaped. Wrapping a value in `"` handles the commas in
   * it, and nothing handled the quotes: a name containing one ended the field
   * early and the rest of it became new columns. CSV escapes a quote by
   * doubling it.
   *
   * And a leading `=`, `+`, `-`, `@`, tab or carriage return makes a spreadsheet
   * read the cell as a formula rather than as text. `=HYPERLINK(...)` in the
   * "full name" box is a link the coach's Excel renders and offers to follow,
   * and the family of `=cmd|...` payloads is worse. Prefixing with an
   * apostrophe is the conventional defusal: Excel shows the text and evaluates
   * nothing.
   */
  const csvCell = (value: unknown): string => {
    const text = value === null || value === undefined ? "" : String(value);
    const defused = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${defused.replace(/"/g, '""')}"`;
  };

  const handleExportToExcel = () => {
    if (profiles.length === 0) {
      toast.error("لا يوجد مشتركون للتصدير");
      return;
    }

    // Build CSV content
    const headers = ["اسم المستخدم", "الاسم الكامل", "رقم الهاتف", "تاريخ الانضمام", "نوع الخطة", "عدد اشهر الاشتراك"];

    const rows = profiles.map(p => {
      const data = getProfileData(p);
      const fullname = data.fullname || "";
      const phone = data.phone || "";
      const plan = planNameFrom(planNames, data.plan, "غير محدد");
      const dateStr = formatTimestamp(data.activation_date || p.created_at);

      const diffMonths = (Array.isArray(data.renewals) ? data.renewals.length : 0) + 1;

      return [
        csvCell(p.username),
        csvCell(fullname),
        csvCell(phone),
        csvCell(dateStr),
        csvCell(plan),
        csvCell(diffMonths),
      ].join(",");
    });

    const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    
    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `subscribers_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`تم تصدير بيانات ${profiles.length} مشترك`);
  };

  const filteredProfiles = profiles
    .filter((p) => {
      const data = getProfileData(p);
      const term = normalizeArabic(search);
      /* Coerced, not optional-chained. `?.` guards null and undefined and
         nothing else, and this blob holds whatever the intake form last wrote —
         the codebase's own note on `ProfileData` says a value that should be a
         number may arrive as one, a numeric string, or absent. A `fullname`
         that is not a string has no `.toLowerCase`, and the exception from here
         takes the entire subscriber list down: a value typed into the public
         registration form, ending the coach's page. */
      const matchesSearch =
        arabicIncludes(data.fullname ?? "", term) ||
        arabicIncludes(p.username ?? "", term);
      
      if (!matchesSearch) return false;
      if (filterPlan !== "all") {
        /* Stored as the plan key from the landing-page link ("plan1".."plan3"),
           never as Arabic text — the old substring matching never matched, so
           every filter returned an empty list. */
        /* The dropdown's values are the stored plan keys themselves now. They
           used to be "bronze"/"silver"/"primary", translated back to plan1..3
           by the three lines that stood here — a second naming scheme that
           existed only so this comparison could undo it, and that had nowhere
           to put the offers. */
        return String(data.plan || "") === filterPlan;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });
  /* Clamped as well as reset: a subscriber deleted from the last page leaves
     `page` pointing one past the end. */
  const perPage = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filteredProfiles.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * perPage;
  const pagedProfiles = filteredProfiles.slice(pageStart, pageStart + perPage);
  /* The bell: every registration and renewal request, newest first. A trainee
     from before `notifications` existed has no list, so an unread `is_new` on
     them stands in as one entry — /api/mark-read turns it into a real one. */
  const notices: Notice[] = profiles.flatMap((p) => {
    const data = getProfileData(p);
    const name = data.fullname || p.username || "غير معروف";
    const list: JsonRecord[] = Array.isArray(data.notifications)
      ? data.notifications
      : data.is_new
        ? [{ id: `legacy-${p.id}`, type: data.is_renewal ? "renewal" : "new", at: p.created_at, read_at: null }]
        : [];
    return list
      .filter((n) => n && typeof n.id === "string")
      .map((n) => ({
        id: n.id,
        profileId: p.id,
        name,
        type: n.type === "renewal" ? "renewal" as const : "new" as const,
        at: String(n.at ?? p.created_at),
        month: typeof n.month === "number" ? n.month : undefined,
        plan: n.plan ?? data.plan,
        readAt: typeof n.read_at === "string" ? n.read_at : null,
      }));
  }).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const unreadCount = notices.filter((n) => !n.readAt).length;
  const shownNotices = notices.filter((n) =>
    noticeFilter === "all" ? true : noticeFilter === "unread" ? !n.readAt : !!n.readAt
  );

  /* The one stat the header shows. Two more were computed here — subscribers
     joined in the last 30 days, and how many have a plan set — and neither was
     ever rendered; there is a single `.crm-hero-stat` in the markup below.
     They are dropped rather than left computing on every render for nobody. */
  const totalSubscribers = profiles.length;

  return (
    <div className="crm-dashboard">
      <Toaster 
        position="top-center" 
        toastOptions={{ 
          style: { 
            /* Was `#141414` — a literal that belongs to no theme, on the one
               surface the courses screen already styles from tokens. */
            background: 'var(--bg2)',
            color: 'var(--text)',
            border: '1px solid var(--primary)',
            padding: '16px 24px',
            borderRadius: "var(--radius-xs)",
            direction: 'rtl',
            fontSize: '0.95rem',
            fontWeight: '600'
          } 
        }} 
      />
      
      <div className="crm-split-layout">
        
        {/* Main List Area */}
        <div className="crm-main-area">
          <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto' }}>
          
          <div className="crm-hero-header">
            <div className="crm-hero-title-group">
              <h1 className="crm-hero-title">ادارة المشتركين</h1>
            </div>
            <div className="crm-hero-stats-group">
              <InstallAppButton />
              <button 
                onClick={() => setShowNotifications(true)}
                className="crm-bell-btn"
                aria-label={unreadCount > 0 ? `الإشعارات (${unreadCount} غير مقروءة)` : "الإشعارات"}
                aria-haspopup="dialog"
                title="الإشعارات"
              >
                <Icon name="notifications_active" style={{ fontSize: "24px", color: "var(--warning-text)" }} />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: "-6px", insetInlineEnd: "-6px", background: "var(--error)", color: "var(--text-inverse)", fontSize: "0.75rem", fontWeight: "bold", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              <div className="crm-hero-stat">
                <span className="stat-val">{totalSubscribers}</span>
                <span className="stat-lbl">إجمالي المتدربين</span>
              </div>
            </div>
          </div>

          {showNotifications && (
            <div
              onClick={(e) => { if (e.target === e.currentTarget) setShowNotifications(false); }}
              style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--overlay-scrim)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
            >
              <div role="dialog" aria-modal="true" aria-labelledby="crm-notices-title" style={{ background: "var(--bg2)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: "600px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "var(--elev-3)", border: "1px solid var(--border)" }}>
                <div style={{ padding: "20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 id="crm-notices-title" style={{ margin: 0, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icon name="notifications_active" style={{ color: "var(--warning-text)" }} />
                    الإشعارات
                  </h3>
                  <button type="button" onClick={() => setShowNotifications(false)} className="crm-notices-close" aria-label="إغلاق الإشعارات" title="إغلاق">
                    <Icon name="close" />
                  </button>
                </div>
                
                {/* Read / unread filter. A segmented control: only the chosen
                    segment is filled, so the three read as one control. */}
                <div style={{ padding: "16px 20px 0" }}>
                  <div role="group" aria-label="تصفية الإشعارات" style={{ display: "flex", gap: "var(--space-1)", padding: "var(--space-1)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                    {([
                      { value: "unread", label: `غير مقروءة (${unreadCount})` },
                      { value: "read", label: "مقروءة" },
                      { value: "all", label: "الكل" },
                    ] as const).map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setNoticeFilter(f.value)}
                        aria-pressed={noticeFilter === f.value}
                        className="crm-notice-filter"
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {shownNotices.length === 0 ? (
                    <p style={{ textAlign: "center", color: "var(--text-muted)", margin: "20px 0" }}>
                      {noticeFilter === "unread" ? "لا توجد إشعارات غير مقروءة." : noticeFilter === "read" ? "لا توجد إشعارات مقروءة." : "لا توجد إشعارات حالياً."}
                    </p>
                  ) : (
                    shownNotices.map((n) => (
                      <div
                        key={n.id}
                        className="crm-alert-row"
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "var(--radius-md)" }}
                      >
                        <button
                          type="button"
                          onClick={() => { const profile = profiles.find(p => p.id === n.profileId); if (profile) handleSelectProfile(profile); }}
                          aria-label={`فتح ملف ${n.name}`}
                          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "12px", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "start", color: "inherit", font: "inherit" }}
                        >
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: n.readAt ? "var(--bg4)" : n.type === "renewal" ? "var(--warning)" : "var(--error)", flexShrink: 0 }} />
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                            <span>
                              <strong style={{ color: "var(--text)", fontSize: "0.95rem" }}>{n.name}</strong>
                              <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                                {" — "}{n.type === "renewal" ? `طلب تجديد اشتراك${n.month ? ` — الشهر ${n.month}` : ""}` : "مشترك جديد"}
                              </span>
                            </span>
                            <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                              {planNameFrom(planNames, n.plan, "غير محدد")} · {formatTimestamp(n.at)}
                            </span>
                          </div>
                        </button>
                        {n.readAt ? (
                          <span title={`قُرئ ${formatTimestamp(n.readAt)}`} style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                            <Icon name="check_circle" style={{ fontSize: 18 }} />
                            مقروء
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(n)}
                            title="تم القراءة"
                            aria-label={`تعليم إشعار ${n.name} كمقروء`}
                            className="crm-mark-read-btn"
                          >
                            <Icon name="check_circle" style={{ fontSize: 18 }} />
                            تم القراءة
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="crm-toolbar">
            <div className="crm-search-box">
              <Icon name="search" className="crm-search-icon" />
              <input 
                type="text" 
                placeholder="ابحث باسم المتدرب أو المعرف..." 
                className="crm-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setSearch(""); }}
              />
              {search && (
                <button
                  type="button"
                  className="crm-search-clear"
                  onClick={() => setSearch("")}
                  aria-label="مسح البحث"
                  title="مسح البحث"
                >
                  <Icon name="close" />
                </button>
              )}
            </div>
            <div className="crm-toolbar-filters">
              <CustomSelect 
                value={filterPlan} 
                onChange={setFilterPlan} 
                /* Listed from the same table the form offers and the tag is
                   coloured from, so the coach can filter by an offer the day it
                   goes live rather than the day someone remembers this file. */
                options={[
                  { value: "all", label: "جميع الخطط" },
                  ...planOptions(planNames),
                ]}
              />
              <CustomSelect 
                value={sortBy} 
                onChange={setSortBy} 
                options={[
                  { value: "newest", label: "الأحدث أولاً" },
                  { value: "oldest", label: "الأقدم أولاً" }
                ]} 
              />
              <button 
                className="crm-export-btn"
                onClick={handleExportToExcel}
                title="تصدير جميع بيانات المشتركين إلى ملف اكسل"
              >
                <Icon name="excel" />
                تصدير اكسل
              </button>
            </div>
          </div>

          {filteredProfiles.length === 0 ? (
            <div className="crm-empty-state">
              <Icon name="person_off" />
              <p>لا يوجد متدربين مطابقين للبحث</p>
            </div>
          ) : (
            <>
            {/* The wrapper is the scroll container: on a phone the columns
                keep a readable width and scroll inside it, the page does not. */}
            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th scope="col" className="crm-table-rank">#</th>
                    <th scope="col">المتدرب</th>
                    <th scope="col">الخطة</th>
                    <th scope="col">نوع الاشتراك</th>
                    <th scope="col">النظام التدريبي</th>
                    <th scope="col">النظام الغذائي</th>
                    <th scope="col">تاريخ البدء</th>
                    <th scope="col"><span className="crm-sr-only">فتح</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProfiles.map((profile, i) => {
                    const data = getProfileData(profile);
                    const displayName = data.fullname || profile.username;

                    /* Which of the trainee's plans are written yet. Only the
                       ones their subscription includes: a diet-only trainee
                       has no training plan to be missing. */
                    const planStatus = (kind: "training" | "diet", at: string | null | undefined) => {
                      if (data.plan_type === (kind === "diet" ? "training" : "diet")) {
                        return <span className="crm-table-none">—</span>;
                      }
                      return (
                        <span
                          className={`crm-table-status ${at ? "is-done" : "is-pending"}`}
                          title={at ? `تم بتاريخ ${formatTimestamp(at)}` : "لم يُنجز بعد"}
                        >
                          {at ? "✓ تم" : "لم يُنجز"}
                        </span>
                      );
                    };

                    /* The whole row opens the profile for a mouse. The name is
                       a real button so the keyboard has a tab stop: its click
                       bubbles to the row's handler, so it needs none of its
                       own. */
                    return (
                      <tr key={profile.id} onClick={() => handleSelectProfile(profile)}>
                        <td className="crm-table-rank">{pageStart + i + 1}</td>
                        <td>
                          <div className="crm-table-person">
                            <span className="crm-table-avatar">
                              <Icon name="user_male" style={{ fontSize: 18 }} />
                            </span>
                            <span className="crm-table-person-text">
                              <button type="button" className="crm-table-name" aria-label={`فتح ملف ${displayName}`}>
                                {displayName}
                              </button>
                              {data.fullname && profile.username && (
                                <span className="crm-table-username" dir="ltr">{profile.username}</span>
                              )}
                            </span>
                            {/* Independent of the bell: marking the request read
                                there does not grant the month, which is still
                                ungranted until the coach approves or rejects it.
                                This is the state that has to stay visible from the
                                list until it is acted on. */}
                            {data.renewal_pending === true && (
                              <span
                                className="crm-table-status is-pending"
                                title="أرسل طلب تجديد وينتظر موافقتك"
                              >
                                تجديد بانتظار المراجعة
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-label="الخطة">
                          {/* The third copy of the plan-to-colour chain, which had
                              no arm for the offers. Shared now, so the tag is
                              coloured from the same table the timeline reads. */}
                          <span
                            className={`crm-tag ${
                              PLAN_COLOUR_SLOT[String(data.plan)]
                                ? `plan-${PLAN_COLOUR_SLOT[String(data.plan)]}`
                                : data.plan ? 'primary-tag' : ''
                            }`}
                            /* A plan past the third has no class in crm.css to
                               match, so it carries its generated colour with it.
                               Null for the first three, which keep the stylesheet's
                               own rules. */
                            style={planTagStyle(String(data.plan)) ?? undefined}
                          >
                            {planNameFrom(planNames, data.plan, "غير محدد")}
                          </span>
                        </td>
                        <td className="crm-table-muted" data-label="نوع الاشتراك">
                          {data.plan_type === 'both' ? 'تدريبي + غذائي' :
                           data.plan_type === 'diet' ? 'غذائي فقط' :
                           data.plan_type === 'training' ? 'تدريبي فقط' : (data.plan_type || "—")}
                        </td>
                        <td data-label="النظام التدريبي">{planStatus("training", profile.course_assigned_at)}</td>
                        <td data-label="النظام الغذائي">{planStatus("diet", profile.diet_updated_at)}</td>
                        <td className="crm-table-muted crm-table-date" data-label="تاريخ البدء">
                          {formatTimestamp(data.activation_date || profile.created_at)}
                        </td>
                        <td className="crm-table-chevron">
                          <Icon name="chevron_left" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="crm-pager">
              <div className="crm-pager-size">
                <CustomSelect
                  value={pageSize}
                  onChange={setPageSize}
                  options={[
                    { value: "10", label: "10" },
                    { value: "20", label: "20" },
                    { value: "50", label: "50" },
                    { value: "100", label: "100" },
                  ]}
                />
                <span>صف</span>
              </div>
              <span className="crm-pager-range">
                {pageStart + 1}-{pageStart + pagedProfiles.length} من {filteredProfiles.length}
              </span>
              <button
                type="button"
                className="crm-pager-btn"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                aria-label="الصفحة السابقة"
                title="الصفحة السابقة"
              >
                <Icon name="chevron_right" />
              </button>
              <button
                type="button"
                className="crm-pager-btn"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= pageCount}
                aria-label="الصفحة التالية"
                title="الصفحة التالية"
              >
                <Icon name="chevron_left" />
              </button>
            </div>
            </>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

