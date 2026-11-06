"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import AppToaster from "@/components/ui/AppToaster";
import AdminModal from "../components/AdminModal";
import { DatePicker } from "@/components/DatePicker";
import { Icon } from "@/components/Icon";
import { confirmDialog } from "@/lib/confirmDialog";
import { formatTimestamp } from "@/lib/trainingDates";
import {
  SUBMISSION_STATUS_LABEL,
  challengeIsOpen,
  whatsAppLink,
  type Challenge,
  type LeaderboardRow,
  type SubmissionRow,
} from "@/lib/challenges";
import {
  deleteChallenge,
  reviewSubmission,
  saveChallenge,
  setChallengeActive,
  type ChallengeInput,
  type ReviewDecision,
} from "./actions";
import "../crm.css";
import "../staff/staff.css";
import "./challenges.css";

type Tab = "pending" | "challenges" | "history" | "points";

const TABS: { id: Tab; label: string; icon: "hourglass" | "emoji_events" | "schedule" | "military_tech" }[] = [
  { id: "pending", label: "بانتظار المراجعة", icon: "hourglass" },
  { id: "challenges", label: "التحديات", icon: "emoji_events" },
  { id: "history", label: "السجل", icon: "schedule" },
  { id: "points", label: "النقاط", icon: "military_tech" },
];

/* The day a stored boundary falls on, in Baghdad — the inverse of the server's
   `dayBoundary`, for filling the date inputs when a challenge is edited. */
function toDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 10);
}

const EMPTY_FORM: ChallengeInput = {
  id: null,
  title: "",
  description: "",
  target: "",
  points: 10,
  video_url: "",
  starts_on: "",
  ends_on: "",
  is_active: true,
};

/* Tells the panel's navigation to read the pending count again. */
function announceChange() {
  window.dispatchEvent(new Event("challenges-changed"));
}

function challengeState(c: Challenge): { label: string; tone: "on" | "off" | "wait" } {
  if (!c.is_active) return { label: "موقوف", tone: "off" };
  if (c.starts_at && new Date(c.starts_at).getTime() > Date.now()) return { label: "لم يبدأ", tone: "wait" };
  if (c.ends_at && new Date(c.ends_at).getTime() < Date.now()) return { label: "منتهي", tone: "off" };
  return { label: "فعّال", tone: "on" };
}

export default function ChallengesClient({
  challenges,
  submissions,
  leaderboard,
  tablesMissing,
  canEdit,
  isOwner,
  userId,
}: {
  challenges: Challenge[];
  submissions: SubmissionRow[];
  leaderboard: LeaderboardRow[];
  tablesMissing: boolean;
  canEdit: boolean;
  isOwner: boolean;
  userId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "pending") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState<string | null>(null);

  const [form, setForm] = useState<ChallengeInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState<SubmissionRow | null>(null);
  const [reason, setReason] = useState("");

  const pending = useMemo(() => submissions.filter((s) => s.status === "pending"), [submissions]);
  const reviewed = useMemo(
    () =>
      submissions
        .filter((s) => s.status !== "pending")
        .sort((a, b) => new Date(b.reviewed_at ?? b.submitted_at).getTime() - new Date(a.reviewed_at ?? a.submitted_at).getTime()),
    [submissions]
  );
  const countsBy = useMemo(() => {
    const m = new Map<string, { pending: number; approved: number }>();
    for (const s of submissions) {
      const e = m.get(s.challenge_id) ?? { pending: 0, approved: 0 };
      if (s.status === "pending") e.pending += 1;
      if (s.status === "approved") e.approved += 1;
      m.set(s.challenge_id, e);
    }
    return m;
  }, [submissions]);

  const mayChange = (c: Challenge) => canEdit && (isOwner || c.created_by === userId);

  const changeTab = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  /* ---------------- review ---------------- */

  const review = async (row: SubmissionRow, decision: ReviewDecision, why?: string) => {
    setBusy(row.id);
    const res = await reviewSubmission(row.id, decision, why);
    setBusy(null);
    if (!res.success) {
      toast.error(res.error);
      return false;
    }
    toast.success(
      decision === "approve"
        ? `تم — أُضيفت ${row.challenge_points} نقطة إلى ${row.trainee_name}`
        : decision === "reject"
          ? "تم رفض الطلب"
          : "أُعيد الطلب إلى قائمة المراجعة"
    );
    announceChange();
    router.refresh();
    return true;
  };

  const approve = async (row: SubmissionRow) => {
    if (
      !(await confirmDialog(
        `تأكيد أن ${row.trainee_name} أتمّ تحدي «${row.challenge_title}»؟ ستُضاف ${row.challenge_points} نقطة إلى رصيده.`,
        { confirmLabel: "تم" }
      ))
    ) {
      return;
    }
    await review(row, "approve");
  };

  const submitReject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rejecting) return;
    if (await review(rejecting, "reject", reason)) setRejecting(null);
  };

  const undo = async (row: SubmissionRow) => {
    const what = row.status === "approved" ? `ستُسحب ${row.points_awarded} نقطة من ${row.trainee_name} و` : "";
    if (!(await confirmDialog(`${what}يعود الطلب إلى قائمة المراجعة. متأكد؟`, { confirmLabel: "تراجع", danger: true }))) {
      return;
    }
    await review(row, "reset");
  };

  /* ---------------- challenges ---------------- */

  const openCreate = () => setForm({ ...EMPTY_FORM });
  const openEdit = (c: Challenge) =>
    setForm({
      id: c.id,
      title: c.title,
      description: c.description,
      target: c.target,
      points: c.points,
      video_url: c.video_url ?? "",
      starts_on: toDay(c.starts_at),
      ends_on: toDay(c.ends_at),
      is_active: c.is_active,
    });

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    const res = await saveChallenge(form);
    setSaving(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    toast.success(form.id ? "تم حفظ التحدي" : "تم إنشاء التحدي — صار ظاهراً للاعبين");
    setForm(null);
    router.refresh();
  };

  const toggle = async (c: Challenge) => {
    setBusy(c.id);
    const res = await setChallengeActive(c.id, !c.is_active);
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    toast.success(c.is_active ? "تم إيقاف التحدي" : "تم تفعيل التحدي");
    router.refresh();
  };

  const remove = async (c: Challenge) => {
    if (!(await confirmDialog(`حذف تحدي «${c.title}» نهائياً؟`, { confirmLabel: "حذف", danger: true }))) return;
    setBusy(c.id);
    const res = await deleteChallenge(c.id);
    setBusy(null);
    if (!res.success) return toast.error(res.error);
    toast.success("تم حذف التحدي");
    announceChange();
    router.refresh();
  };

  const set = <K extends keyof ChallengeInput>(key: K, value: ChallengeInput[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  /* ---------------- render ---------------- */

  const traineeLink = (row: SubmissionRow) =>
    row.trainee_phone ? (
      <a
        className="crm-btn-secondary chl-review-btn"
        href={whatsAppLink(row.trainee_phone)}
        target="_blank"
        rel="noopener noreferrer"
        title="افتح محادثة اللاعب على واتساب لمشاهدة الفيديو"
      >
        <Icon name="chat" />
        مراجعة
      </a>
    ) : (
      <a
        className="crm-btn-secondary chl-review-btn"
        href={`/admin/profile/${row.profile_id}`}
        target="_blank"
        rel="noopener noreferrer"
        title="لا يوجد رقم هاتف في ملف اللاعب"
      >
        <Icon name="person" />
        الملف
      </a>
    );

  return (
    <div className="chl-page">
      <AppToaster />

      <header className="chl-header">
        <div>
          <h1>التحديات</h1>
          <p className="chl-lead">
            سوِّ تحدياً للاعبين. اللاعب يصوّر نفسه ويرسل الفيديو على واتساب، وانت تضغط «تم» هنا حتى تنضاف نقاطه.
          </p>
        </div>
        {canEdit && !tablesMissing && (
          <button type="button" className="staff-add-btn chl-add-btn" onClick={openCreate}>
            <Icon name="add" />
            تحدي جديد
          </button>
        )}
      </header>

      {tablesMissing && (
        <div className="chl-setup" role="status">
          <Icon name="warning" />
          <div>
            <strong>التحديات غير مفعّلة بعد.</strong>
            <span>
              شغّل في SQL Editor داخل Supabase الملف <code dir="ltr">prisma/manual/2026-11-04-challenges.sql</code> ثم حدّث
              الصفحة.
            </span>
          </div>
        </div>
      )}

      <div className="chl-tabs" role="tablist" aria-label="أقسام التحديات">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`chl-tab${tab === t.id ? " is-active" : ""}`}
            onClick={() => changeTab(t.id)}
          >
            <Icon name={t.icon} />
            <span>{t.label}</span>
            {t.id === "pending" && pending.length > 0 && <span className="chl-count">{pending.length}</span>}
          </button>
        ))}
      </div>

      {/* ---------- pending ---------- */}
      {tab === "pending" &&
        (pending.length === 0 ? (
          <div className="chl-empty">
            <Icon name="check_circle" />
            <p>ماكو طلبات تنتظر المراجعة.</p>
          </div>
        ) : (
          <div className="chl-list">
            {pending.map((row) => (
              <article key={row.id} className="chl-row">
                <div className="chl-row-main">
                  <span className="chl-avatar" aria-hidden="true">
                    <Icon name="person" />
                  </span>
                  <div className="chl-row-text">
                    <span className="chl-row-title">
                      {row.trainee_name}
                      <span className="chl-row-sub"> أتمّ تحدي «{row.challenge_title}»</span>
                    </span>
                    <span className="chl-row-meta">
                      {row.challenge_target && <span>{row.challenge_target}</span>}
                      <span className="chl-points">+{row.challenge_points} نقطة</span>
                      <span dir="ltr" className="chl-ref">{row.reference}</span>
                      <span>{formatTimestamp(row.submitted_at)}</span>
                    </span>
                  </div>
                </div>
                <div className="chl-row-actions">
                  {traineeLink(row)}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        className="crm-btn-primary chl-approve-btn"
                        onClick={() => approve(row)}
                        disabled={busy === row.id}
                      >
                        <Icon name="check_circle" />
                        تم
                      </button>
                      <button
                        type="button"
                        className="crm-btn-secondary chl-reject-btn"
                        onClick={() => {
                          setReason("");
                          setRejecting(row);
                        }}
                        disabled={busy === row.id}
                      >
                        <Icon name="close" />
                        رفض
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ))}

      {/* ---------- challenges ---------- */}
      {tab === "challenges" &&
        (challenges.length === 0 ? (
          <div className="chl-empty">
            <Icon name="emoji_events" />
            <p>ماكو تحديات بعد{canEdit && !tablesMissing ? " — اضغط «تحدي جديد»" : ""}.</p>
          </div>
        ) : (
          <div className="chl-grid">
            {challenges.map((c) => {
              const state = challengeState(c);
              const counts = countsBy.get(c.id) ?? { pending: 0, approved: 0 };
              return (
                <article key={c.id} className={`chl-card${challengeIsOpen(c) ? "" : " is-closed"}`}>
                  <div className="chl-card-head">
                    <span className="chl-card-icon" aria-hidden="true">
                      <Icon name="emoji_events" />
                    </span>
                    <div className="chl-card-id">
                      <span className="chl-card-title">{c.title}</span>
                      {c.target && <span className="chl-card-target">{c.target}</span>}
                    </div>
                    <span className={`chl-state is-${state.tone}`}>{state.label}</span>
                  </div>

                  {c.description && <p className="chl-card-desc">{c.description}</p>}

                  <div className="chl-card-stats">
                    <span>
                      <strong>{c.points}</strong> نقطة
                    </span>
                    <span>
                      <strong>{counts.approved}</strong> أتمّوه
                    </span>
                    <span>
                      <strong>{counts.pending}</strong> بانتظار
                    </span>
                  </div>

                  {(c.starts_at || c.ends_at) && (
                    <p className="chl-card-dates">
                      <Icon name="calendar_month" />
                      {c.starts_at ? `من ${formatTimestamp(c.starts_at)}` : ""}
                      {c.starts_at && c.ends_at ? " " : ""}
                      {c.ends_at ? `إلى ${formatTimestamp(c.ends_at)}` : ""}
                    </p>
                  )}
                  {c.created_by_name && <p className="chl-card-by">أنشأه {c.created_by_name}</p>}

                  {mayChange(c) && (
                    <div className="chl-card-actions">
                      <button type="button" className="crm-btn-secondary" onClick={() => openEdit(c)} disabled={busy === c.id}>
                        <Icon name="edit" />
                        تعديل
                      </button>
                      <button type="button" className="crm-btn-secondary" onClick={() => toggle(c)} disabled={busy === c.id}>
                        <Icon name={c.is_active ? "block" : "check_circle"} />
                        {c.is_active ? "إيقاف" : "تفعيل"}
                      </button>
                      <button
                        type="button"
                        className="staff-icon-btn is-danger"
                        onClick={() => remove(c)}
                        disabled={busy === c.id}
                        title="حذف"
                        aria-label={`حذف ${c.title}`}
                      >
                        <Icon name="delete" />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ))}

      {/* ---------- history ---------- */}
      {tab === "history" &&
        (reviewed.length === 0 ? (
          <div className="chl-empty">
            <Icon name="schedule" />
            <p>ماكو طلبات مراجَعة بعد.</p>
          </div>
        ) : (
          <div className="chl-list">
            {reviewed.map((row) => (
              <article key={row.id} className="chl-row">
                <div className="chl-row-main">
                  <span className={`chl-status is-${row.status}`}>{SUBMISSION_STATUS_LABEL[row.status]}</span>
                  <div className="chl-row-text">
                    <span className="chl-row-title">
                      {row.trainee_name}
                      <span className="chl-row-sub"> — {row.challenge_title}</span>
                    </span>
                    <span className="chl-row-meta">
                      {row.status === "approved" && <span className="chl-points">+{row.points_awarded} نقطة</span>}
                      <span dir="ltr" className="chl-ref">{row.reference}</span>
                      <span>
                        {formatTimestamp(row.reviewed_at)}
                        {row.reviewed_by_name ? ` · ${row.reviewed_by_name}` : ""}
                      </span>
                    </span>
                    {row.reject_reason && <span className="chl-reason">السبب: {row.reject_reason}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="chl-row-actions">
                    <button type="button" className="crm-btn-secondary" onClick={() => undo(row)} disabled={busy === row.id}>
                      <Icon name="restore" />
                      تراجع
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ))}

      {/* ---------- points ---------- */}
      {tab === "points" &&
        (leaderboard.length === 0 ? (
          <div className="chl-empty">
            <Icon name="military_tech" />
            <p>ما أحد حصل نقاط بعد.</p>
          </div>
        ) : (
          <ol className="chl-board">
            {leaderboard.map((r, i) => (
              <li key={r.profile_id} className={`chl-board-row${i < 3 ? ` is-top is-top-${i + 1}` : ""}`}>
                <span className="chl-rank">{i + 1}</span>
                <a className="chl-board-name" href={`/admin/profile/${r.profile_id}`} target="_blank" rel="noopener noreferrer">
                  {r.trainee_name}
                </a>
                <span className="chl-board-done">{r.completed} تحدي</span>
                <span className="chl-board-points">{r.points} نقطة</span>
              </li>
            ))}
          </ol>
        ))}

      {/* ---------- editor ---------- */}
      <AdminModal
        isOpen={form !== null}
        onClose={() => !saving && setForm(null)}
        title={form?.id ? "تعديل التحدي" : "تحدي جديد"}
        icon="emoji_events"
        maxWidth={640}
        footer={
          <div className="staff-modal-foot">
            <button type="button" className="crm-btn-secondary" onClick={() => setForm(null)} disabled={saving}>
              إلغاء
            </button>
            <button type="submit" form="chl-form" className="crm-btn-primary" disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        }
      >
        {form && (
          <form id="chl-form" className="chl-form" onSubmit={submitForm}>
            <label className="chl-field">
              <span>اسم التحدي *</span>
              <input
                className="form-input ui-control"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="مثال: تحدي الضغط"
                maxLength={120}
                required
              />
            </label>
            <div className="chl-fields">
              <label className="chl-field">
                <span>الهدف</span>
                <input
                  className="form-input ui-control"
                  value={form.target}
                  onChange={(e) => set("target", e.target.value)}
                  placeholder="مثال: 30 ضغطة أو بلانك دقيقتين"
                  maxLength={120}
                />
              </label>
              <label className="chl-field">
                <span>النقاط *</span>
                <input
                  className="form-input ui-control"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10000}
                  value={form.points}
                  onChange={(e) => set("points", Number(e.target.value))}
                  required
                />
              </label>
            </div>
            <label className="chl-field">
              <span>الشرح</span>
              <textarea
                className="form-input ui-control"
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="كيف يصوّر اللاعب نفسه، وشنو الشروط حتى ينقبل التحدي"
                maxLength={2000}
              />
            </label>
            <label className="chl-field">
              <span>رابط فيديو الشرح (اختياري)</span>
              <input
                className="form-input ui-control"
                dir="ltr"
                type="url"
                value={form.video_url}
                onChange={(e) => set("video_url", e.target.value)}
                placeholder="https://..."
                maxLength={500}
              />
            </label>
            <div className="chl-fields">
              <div className="chl-field">
                <span>يبدأ من (اختياري)</span>
                <DatePicker
                  label="تاريخ البداية"
                  placeholder="من اليوم"
                  clearable
                  value={form.starts_on || null}
                  onChange={(picked) => {
                    const v = picked ?? "";
                    set("starts_on", v);
                    /* An end before the new start would be refused on save. */
                    if (v && form.ends_on && form.ends_on < v) set("ends_on", "");
                  }}
                  rangeStart={form.starts_on}
                  rangeEnd={form.ends_on}
                />
              </div>
              <div className="chl-field">
                <span>ينتهي في (اختياري)</span>
                <DatePicker
                  label="تاريخ النهاية"
                  placeholder="بدون نهاية"
                  clearable
                  value={form.ends_on || null}
                  onChange={(picked) => set("ends_on", picked ?? "")}
                  minDate={form.starts_on || undefined}
                  rangeStart={form.starts_on}
                  rangeEnd={form.ends_on}
                />
              </div>
            </div>
            <label className="staff-switch-row chl-switch">
              <span className="staff-switch-text">ظاهر للاعبين</span>
              <span className="ui-switch">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
                <span className="ui-switch-track" aria-hidden="true" />
              </span>
            </label>
          </form>
        )}
      </AdminModal>

      {/* ---------- reject ---------- */}
      <AdminModal
        isOpen={rejecting !== null}
        onClose={() => busy === null && setRejecting(null)}
        title="رفض الطلب"
        icon="close"
        maxWidth={520}
        footer={
          <div className="staff-modal-foot">
            <button type="button" className="crm-btn-secondary" onClick={() => setRejecting(null)} disabled={busy !== null}>
              إلغاء
            </button>
            <button type="submit" form="chl-reject-form" className="crm-btn-primary chl-danger-btn" disabled={busy !== null}>
              رفض
            </button>
          </div>
        }
      >
        {rejecting && (
          <form id="chl-reject-form" className="chl-form" onSubmit={submitReject}>
            <p className="chl-form-note">
              رفض طلب <strong>{rejecting.trainee_name}</strong> لتحدي «{rejecting.challenge_title}». يقدر اللاعب يعيد
              المحاولة بعد الرفض.
            </p>
            <label className="chl-field">
              <span>السبب (يظهر للاعب — اختياري)</span>
              <textarea
                className="form-input ui-control"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="مثال: العدد ما كمل، أو الفيديو مقطوع"
                maxLength={300}
              />
            </label>
          </form>
        )}
      </AdminModal>
    </div>
  );
}
