"use client";

import type { JsonRecord } from "@/types";
import { useEffect, useState } from "react";
import { Profile } from "@/types/admin";
import { Toaster, toast } from "react-hot-toast";
import { PLAN_COLOUR_SLOT } from "@/lib/formLabels";
import { planNameFrom, planOptions, type PlanNames } from "@/lib/planNames";
import { Icon } from "@/components/Icon";
import { CustomSelect } from "@/components/CustomSelect";
import { useNow } from "@/hooks/useNow";
import { formatTimestamp } from "@/lib/trainingDates";
import "./crm.css";
import { normalizeArabic, arabicIncludes } from "@/lib/arabicSearch";

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
  /* The notification counts below are "how many 30-day cycles since this
     trainee started", so they need the clock. Read through the hook rather
     than calling Date.now() in the body: a render that answers differently
     each time it runs is what `react-hooks/purity` is about, and here it would
     mean two renders disagreeing about whose plan is due. */
  const now = useNow();

  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showNotifications, setShowNotifications] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles || []);

  useEffect(() => {
    // Show persistent toasts for unread profiles on mount
    profiles.forEach(p => {
      const data = getProfileData(p);
      if (data.is_new) {
        toast(() => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 'bold' }}>
              <Icon name="notifications_active" style={{ fontSize: 20 }} />
              {data.is_renewal ? 'طلب تجديد اشتراك!' : 'مشترك جديد!'}
            </div>
            <div>
              قام <strong>{data.fullname || p.username}</strong> للتو بطلب {data.is_renewal ? 'تجديد الاشتراك' : 'التسجيل'} واختار: 
              <br/> <span style={{ color: 'var(--primary)' }}>{planNameFrom(planNames, data.plan, "غير محدد")}</span>
            </div>
          </div>
        ), {
          id: p.id, // Use profile ID so we can dismiss it later
          duration: Infinity, // Doesn't disappear
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectProfile = async (profile: Profile) => {
    // Open in a new tab immediately
    window.open(`/admin/profile/${profile.id}`, '_blank');
    
    const data = getProfileData(profile);
    if (data.is_new) {
      // Dismiss the toast
      toast.dismiss(profile.id);
      
      // Update local state to remove the badge
      setProfiles(prev => prev.map(p => {
        if (p.id === profile.id) {
          const pData = getProfileData(p);
          return { ...p, data: { ...pData, is_new: false } };
        }
        return p;
      }));

      // Call API to update database
      try {
        await fetch("/api/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: profile.id })
        });
      } catch (err) {
        console.error("Failed to mark profile as read", err);
      }
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
    if (profiles.length === 0) return;

    // Build CSV content
    const headers = ["اسم المستخدم", "الاسم الكامل", "رقم الهاتف", "تاريخ الانضمام", "نوع الخطة", "عدد اشهر الاشتراك"];

    const rows = profiles.map(p => {
      const data = getProfileData(p);
      const fullname = data.fullname || "";
      const phone = data.phone || "";
      const plan = planNameFrom(planNames, data.plan, "غير محدد");
      const dateObj = new Date(p.created_at);
      const dateStr = formatTimestamp(dateObj);

      const diffTime = Date.now() - dateObj.getTime();
      // Using 30.44 days for an average month
      const diffMonths = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)));

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
  // Calculate Notifications
  const updateNotifications = profiles.reduce((acc, p) => {
    const data = getProfileData(p);
    const diffTime = now - new Date(p.created_at).getTime();
    const daysSinceStart = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Check if they need updates based on multiples of 30 and 60 days
    const dietCycles = Math.floor(daysSinceStart / 30);
    const workoutCycles = Math.floor(daysSinceStart / 60);
    
    if (dietCycles > 0 || workoutCycles > 0) {
      const msgs = [];
      if (dietCycles > 0) msgs.push(`النظام الغذائي`);
      if (workoutCycles > 0) msgs.push(`النظام التدريبي`);
      
      acc.push({
        id: p.id,
        name: data.fullname || p.username || "غير معروف",
        text: `يحتاج تحديث: ${msgs.join(" و ")}`,
        days: daysSinceStart
      });
    }
    return acc;
  }, [] as {id: string, name: string, text: string, days: number}[]).sort((a, b) => b.days - a.days);

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
          <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div className="crm-hero-header">
            <div className="crm-hero-title-group">
              <h1 className="crm-hero-title">ادارة المشتركين</h1>
            </div>
            <div className="crm-hero-stats-group" style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <button 
                onClick={() => setShowNotifications(true)}
                style={{ position: "relative", background: "var(--bg3)", padding: "12px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Icon name="notifications_active" style={{ fontSize: "24px", color: "var(--warning)" }} />
                {updateNotifications.length > 0 && (
                  <span style={{ position: "absolute", top: "-6px", insetInlineEnd: "-6px", background: "var(--error)", color: "var(--text-inverse)", fontSize: "0.75rem", fontWeight: "bold", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {updateNotifications.length}
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
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--overlay-scrim, rgba(0,0,0,0.6))", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
              <div style={{ background: "var(--bg2)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: "600px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "var(--elev-3)", border: "1px solid var(--border)" }}>
                <div style={{ padding: "20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Icon name="notifications_active" style={{ color: "var(--warning)" }} />
                    تنبيهات بتحديث الأنظمة
                  </h3>
                  <button onClick={() => setShowNotifications(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}>
                    <Icon name="close" />
                  </button>
                </div>
                
                <div style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {updateNotifications.length === 0 ? (
                    <p style={{ textAlign: "center", color: "var(--text-muted)", margin: "20px 0" }}>لا توجد تنبيهات حالياً.</p>
                  ) : (
                    updateNotifications.map((n, idx) => (
                      <div key={`${n.id}-${idx}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", padding: "12px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--warning)", flexShrink: 0 }} />
                          <strong style={{ color: "var(--text)", fontSize: "0.95rem" }}>{n.name}</strong>
                          <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>— {n.text}</span>
                        </div>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", background: "var(--bg3)", padding: "4px 8px", borderRadius: "var(--radius-xs)" }}>
                          مضى {n.days} يوم
                        </span>
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
              />
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

          <div className="crm-list-cards">
            {filteredProfiles.length === 0 ? (
              <div className="crm-empty-state">
                <Icon name="person_off" />
                <p>لا يوجد متدربين مطابقين للبحث</p>
              </div>
            ) : (
              filteredProfiles.map((profile, i) => {
                const data = getProfileData(profile);
                const displayName = data.fullname || profile.username;

                /* A div with an onClick is invisible to a keyboard: the whole
                   subscriber list could only be opened with a mouse. Given a
                   role, a tab stop and the Enter/Space handling a button would
                   have had for free. */
                return (
                  <div
                    key={profile.id}
                    className="crm-list-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectProfile(profile)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectProfile(profile);
                      }
                    }}
                    aria-label={`فتح ملف ${displayName}`}
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="crm-card-avatar" style={{ position: 'relative' }}>
                      <Icon name="user_male" style={{ fontSize: 28 }} />
                      {/* `--bg-2` was not a token — the project's are `--bg2` and
                          `--bg3`. An undefined custom property with no fallback
                          invalidates the whole `border` shorthand, so the dot lost
                          the ring meant to separate it from the avatar behind it.
                          `insetInlineEnd` so it mirrors: `right` pinned it to the
                          same visual corner in an interface that is entirely
                          right-to-left. */}
                      {data.is_new && (
                        /* The dot means "unread", and the two things it can be
                           unread about are not the same event. Its tooltip said
                           "مشترك جديد" for both, so a renewal announced itself
                           as a stranger — which is the one thing this flow must
                           never do. */
                        <div
                          style={{ position: 'absolute', top: -2, insetInlineEnd: -2, width: 12, height: 12, background: data.is_renewal ? '#F59E0B' : 'var(--error)', borderRadius: '50%', border: '2px solid var(--bg2)' }}
                          title={data.is_renewal ? "طلب تجديد اشتراك" : "مشترك جديد"}
                        ></div>
                      )}
                    </div>
                    
                    <div className="crm-card-info">
                      <h4 className="crm-card-name" style={{ margin: 0 }}>{displayName}</h4>
                    </div>

                    <div className="crm-card-meta">
                      {/* Survives the row being marked read, unlike the dot
                          beside it: `is_new` is cleared the moment the coach
                          opens the trainee, but the month is still ungranted
                          until they decide. This is the state that has to stay
                          visible from the list until it is acted on. */}
                      {data.renewal_pending === true && (
                        <span
                          className="crm-tag"
                          style={{ background: "color-mix(in srgb, #F59E0B 20%, var(--bg3))", color: "#F59E0B", border: "1px solid color-mix(in srgb, #F59E0B 45%, var(--border))", fontWeight: 800 }}
                          title="أرسل طلب تجديد وينتظر موافقتك"
                        >
                          تجديد بانتظار المراجعة
                        </span>
                      )}
                      {/* The third copy of the plan-to-colour chain, which had
                          no arm for the offers. Shared now, so the tag is
                          coloured from the same table the timeline reads. */}
                      <span className={`crm-tag ${
                        PLAN_COLOUR_SLOT[String(data.plan)]
                          ? `plan-${PLAN_COLOUR_SLOT[String(data.plan)]}`
                          : data.plan ? 'primary-tag' : ''
                      }`}>
                        {planNameFrom(planNames, data.plan, "غير محدد")}
                      </span>
                      {data.plan_type && (
                        <span className="crm-tag" style={{ background: "var(--bg3)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                          {data.plan_type === 'both' ? 'نظام تدريبي + غذائي' : 
                           data.plan_type === 'diet' ? 'نظام غذائي فقط' : 
                           data.plan_type === 'training' ? 'نظام تدريبي فقط' : data.plan_type}
                        </span>
                      )}
                      <span className="crm-card-date" title="تاريخ بداية الاشتراك">
                        <Icon name="calendar_today" style={{ fontSize: 14 }} />
                        {formatTimestamp(data.activation_date || profile.created_at)}
                      </span>
                    </div>

                    <div className="crm-card-actions">
                      <Icon name="chevron_left" className="crm-chevron" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

