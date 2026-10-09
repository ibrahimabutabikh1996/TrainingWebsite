"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import AdminModal from "../components/AdminModal";
import { Icon } from "@/components/Icon";
import { confirmDialog } from "@/lib/confirmDialog";
import { formatTimestamp } from "@/lib/trainingDates";
import {
  SECTION_LEVELS,
  STAFF_ACTIONS,
  STAFF_SECTIONS,
  normalizePermissions,
  sectionLevel,
  type SectionLevel,
  type StaffSection,
} from "@/lib/staffPermissions";
import "../crm.css";
import "./staff.css";

export interface StaffMember {
  accountId: string;
  username: string;
  permissions: string[];
  isSuspended: boolean;
  createdAt: string;
  /** The trainees (profile ids) this staff member may see. */
  traineeIds: string[];
}

export interface StaffTraineeOption {
  id: string;
  name: string;
  username: string;
}

type Levels = Record<StaffSection, SectionLevel>;

type Editor =
  | { mode: "create" }
  | { mode: "permissions"; member: StaffMember }
  | { mode: "password"; member: StaffMember }
  | { mode: "trainees"; member: StaffMember }
  | null;

const LEVEL_LABEL: Record<SectionLevel, string> = Object.fromEntries(
  SECTION_LEVELS.map((l) => [l.value, l.label])
) as Record<SectionLevel, string>;

function levelsOf(permissions: readonly string[]): Levels {
  return Object.fromEntries(
    STAFF_SECTIONS.map((s) => [s.key, sectionLevel(permissions, s.key)])
  ) as Levels;
}

function grantOf(levels: Levels, actions: readonly string[]): string[] {
  const sections = STAFF_SECTIONS.flatMap((s) =>
    levels[s.key] === "none" ? [] : [`${s.key}.${levels[s.key]}`]
  );
  return normalizePermissions([...sections, ...actions]);
}

export default function AdminStaffClient({
  staff,
  trainees,
}: {
  staff: StaffMember[];
  /** Every trainee, for choosing whom each staff member sees. */
  trainees: StaffTraineeOption[];
}) {
  const router = useRouter();

  const [editor, setEditor] = useState<Editor>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [levels, setLevels] = useState<Levels>(() => levelsOf([]));
  const [actions, setActions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [chosenTrainees, setChosenTrainees] = useState<string[]>([]);
  const [traineeQuery, setTraineeQuery] = useState("");
  /** The one card whose permissions note is open. */
  const [noteFor, setNoteFor] = useState<string | null>(null);

  const openCreate = () => {
    setUsername("");
    setPassword("");
    setLevels(levelsOf([]));
    setActions([]);
    setEditor({ mode: "create" });
  };

  const openPermissions = (member: StaffMember) => {
    setLevels(levelsOf(member.permissions));
    setActions(STAFF_ACTIONS.map((a) => a.key).filter((k) => member.permissions.includes(k)));
    setEditor({ mode: "permissions", member });
  };

  const openPassword = (member: StaffMember) => {
    setPassword("");
    setEditor({ mode: "password", member });
  };

  const openTrainees = (member: StaffMember) => {
    setChosenTrainees(member.traineeIds);
    setTraineeQuery("");
    setEditor({ mode: "trainees", member });
  };

  const close = () => {
    if (!busy) setEditor(null);
  };

  /** Sends one request; on success refreshes the list from the server. */
  const send = async (url: string, method: string, body?: unknown, done?: string): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "حدث خطأ، حاول مرة أخرى");
        return false;
      }
      if (done) toast.success(done);
      router.refresh();
      return true;
    } catch {
      toast.error("تعذّر الاتصال بالخادم");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;

    let ok = false;
    if (editor.mode === "create") {
      ok = await send(
        "/api/admin/staff",
        "POST",
        { username: username.trim(), password, permissions: grantOf(levels, actions) },
        "تم إنشاء المشرف"
      );
    } else if (editor.mode === "permissions") {
      ok = await send(
        "/api/admin/staff",
        "PATCH",
        { accountId: editor.member.accountId, permissions: grantOf(levels, actions) },
        "تم حفظ الصلاحيات"
      );
    } else if (editor.mode === "trainees") {
      ok = await send(
        "/api/admin/staff",
        "PATCH",
        { accountId: editor.member.accountId, traineeIds: chosenTrainees },
        "تم حفظ المشتركين"
      );
    } else {
      ok = await send(
        "/api/admin/staff",
        "PATCH",
        { accountId: editor.member.accountId, password },
        "تم تغيير كلمة المرور"
      );
    }
    if (ok) setEditor(null);
  };

  const toggleSuspended = async (member: StaffMember) => {
    const suspending = !member.isSuspended;
    if (
      suspending &&
      !(await confirmDialog(`إيقاف المشرف «${member.username}»؟ سيُمنع من الدخول إلى اللوحة فوراً.`, {
        confirmLabel: "إيقاف",
        danger: true,
      }))
    ) {
      return;
    }
    await send(
      "/api/admin/staff",
      "PATCH",
      { accountId: member.accountId, isSuspended: suspending },
      suspending ? "تم إيقاف المشرف" : "تم تفعيل المشرف"
    );
  };

  const remove = async (member: StaffMember) => {
    if (
      !(await confirmDialog(
        `حذف المشرف «${member.username}» نهائياً؟ الكورسات التي أنشأها ستنتقل إليك.`,
        { confirmLabel: "حذف", danger: true }
      ))
    ) {
      return;
    }
    await send(`/api/admin/staff?id=${member.accountId}`, "DELETE", undefined, "تم حذف المشرف");
  };

  const subscribersHidden = levels.subscribers === "none";

  const permissionsEditor = (
    <div className="staff-perms">
      <section className="staff-group">
        <div className="staff-group-head">
          <span className="staff-group-icon">
            <Icon name="layers" />
          </span>
          <div>
            <p className="staff-perms-title">الأقسام</p>
            <p className="staff-perms-note">حدد ما يراه المشرف في كل قسم.</p>
          </div>
        </div>
        <div className="staff-list">
      {STAFF_SECTIONS.map((section) => (
        <div key={section.key} className="staff-perm-row">
          <div className="staff-perm-text">
            <span className="staff-perm-label">{section.label}</span>
            <span className="staff-perm-hint">{section.hint}</span>
          </div>
          <div className="staff-segment" role="radiogroup" aria-label={section.label}>
            {SECTION_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                role="radio"
                aria-checked={levels[section.key] === level.value}
                className={`staff-segment-btn${levels[section.key] === level.value ? " is-active" : ""}`}
                data-level={level.value}
                onClick={() => setLevels((prev) => ({ ...prev, [section.key]: level.value }))}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>
      ))}
        </div>
      </section>

      <section className="staff-group">
        <div className="staff-group-head">
          <span className="staff-group-icon is-warning">
            <Icon name="warning" />
          </span>
          <div>
            <p className="staff-perms-title">صلاحيات حساسة على المشتركين</p>
            <p className="staff-perms-note">
              {subscribersHidden
                ? "تحتاج هذه الصلاحيات إلى إظهار قسم المشتركين أولاً."
                : "تمنح المشرف تحكماً مباشراً في حسابات المشتركين."}
            </p>
          </div>
        </div>
        <div className="staff-list">
      {STAFF_ACTIONS.map((action) => (
        <label key={action.key} className={`staff-switch-row${subscribersHidden ? " is-disabled" : ""}`}>
          <span className="staff-switch-text">{action.label}</span>
          <span className="ui-switch">
            <input
              type="checkbox"
              disabled={subscribersHidden}
              checked={!subscribersHidden && actions.includes(action.key)}
              onChange={(e) =>
                setActions((prev) =>
                  e.target.checked ? [...prev, action.key] : prev.filter((k) => k !== action.key)
                )
              }
            />
            <span className="ui-switch-track" aria-hidden="true" />
          </span>
        </label>
      ))}
        </div>
      </section>
    </div>
  );

  const query = traineeQuery.trim().toLowerCase();
  const shownTrainees = query
    ? trainees.filter(
        (t) => t.name.toLowerCase().includes(query) || t.username.toLowerCase().includes(query)
      )
    : trainees;

  const traineePicker = (
    <div className="staff-perms">
      <section className="staff-group">
        <div className="staff-group-head">
          <span className="staff-group-icon">
            <Icon name="group" />
          </span>
          <div>
            <p className="staff-perms-title">المشتركون المسموح بهم ({chosenTrainees.length})</p>
            <p className="staff-perms-note">لن يرى المشرف إلا هؤلاء، في كل أقسام اللوحة.</p>
          </div>
        </div>
        <input
          className="form-input ui-control"
          type="search"
          placeholder="ابحث بالاسم أو اسم المستخدم..."
          value={traineeQuery}
          onChange={(e) => setTraineeQuery(e.target.value)}
          aria-label="بحث عن مشترك"
        />
        <div className="staff-list staff-trainee-list">
          {shownTrainees.length === 0 && (
            <p className="staff-perms-note staff-trainee-empty">لا يوجد مشترك مطابق.</p>
          )}
          {shownTrainees.map((t) => (
            <label key={t.id} className="staff-switch-row">
              <span className="staff-switch-text">
                {t.name} <span className="staff-perm-hint" dir="ltr">{t.username}</span>
              </span>
              <span className="ui-switch">
                <input
                  type="checkbox"
                  checked={chosenTrainees.includes(t.id)}
                  onChange={(e) =>
                    setChosenTrainees((prev) =>
                      e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                    )
                  }
                />
                <span className="ui-switch-track" aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );

  const modalTitle =
    editor?.mode === "create"
      ? "إضافة مشرف"
      : editor?.mode === "permissions"
        ? `صلاحيات «${editor.member.username}»`
        : editor?.mode === "password"
          ? `كلمة مرور «${editor.member.username}»`
          : editor?.mode === "trainees"
            ? `مشتركو «${editor.member.username}»`
            : "";

  return (
    <div className="staff-page">
      <Toaster position="top-center" />

      <header className="staff-header">
        <div>
          <h1>إدارة المشرفين</h1>
          <p className="staff-lead">
            أنشئ حسابات لمساعديك وحدد لكل منهم ما يراه وما يستطيع فعله في اللوحة. أي تغيير هنا يسري فوراً.
          </p>
        </div>
        <button type="button" className="staff-add-btn" onClick={openCreate}>
          <Icon name="person_add" />
          إضافة مشرف
        </button>
      </header>

      {staff.length === 0 ? (
        <div className="staff-empty">
          <Icon name="verified_user" />
          <p>لا يوجد مشرفون بعد.</p>
        </div>
      ) : (
        <div className="staff-grid">
          {staff.map((member) => {
            const traineeCount = member.traineeIds.length;
            const suspendLabel = member.isSuspended ? "تفعيل" : "إيقاف";
            const noteOpen = noteFor === member.accountId;
            const noteId = `staff-note-${member.accountId}`;
            const memberLevels = levelsOf(member.permissions);
            const grantedSections = STAFF_SECTIONS.filter((s) => memberLevels[s.key] !== "none");
            const grantedActions = STAFF_ACTIONS.filter((a) => member.permissions.includes(a.key));
            return (
              <article key={member.accountId} className={`staff-card${member.isSuspended ? " is-suspended" : ""}`}>
                <div className="staff-card-head">
                  <span className="staff-avatar" aria-hidden="true">
                    {member.username.charAt(0).toUpperCase()}
                  </span>
                  <div className="staff-card-id">
                    <span className="staff-card-name" dir="ltr">{member.username}</span>
                    <span className="staff-card-sub">
                      مشرف منذ {formatTimestamp(member.createdAt)}
                    </span>
                  </div>
                  <span className={`staff-status${member.isSuspended ? " is-off" : ""}`}>
                    {member.isSuspended ? "موقوف" : "نشط"}
                  </span>
                </div>

                <p className="staff-card-meta">
                  <Icon name="group" />
                  <span>المشتركون المسندون</span>
                  <strong>{traineeCount}</strong>
                </p>

                {noteOpen && (
                  <div id={noteId} className="staff-note">
                    <p className="staff-note-title">الصلاحيات المعطاة</p>
                    {grantedSections.length === 0 && grantedActions.length === 0 ? (
                      <p className="staff-note-empty">لا توجد صلاحيات.</p>
                    ) : (
                      <>
                        {grantedSections.length > 0 && (
                          <ul className="staff-note-levels">
                            {grantedSections.map((s) => (
                              <li key={s.key}>
                                <span>{s.label}</span>
                                <span className="staff-note-level" data-level={memberLevels[s.key]}>
                                  {LEVEL_LABEL[memberLevels[s.key]]}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {grantedActions.length > 0 && (
                          <>
                            <p className="staff-note-title">صلاحيات حساسة</p>
                            <ul className="staff-note-actions">
                              {grantedActions.map((a) => (
                                <li key={a.key}>{a.label}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="staff-card-actions">
                  <button type="button" className="crm-btn-secondary" onClick={() => openPermissions(member)} disabled={busy}>
                    <Icon name="edit" />
                    الصلاحيات
                  </button>
                  <button type="button" className="crm-btn-secondary" onClick={() => openTrainees(member)} disabled={busy}>
                    <Icon name="group" />
                    المشتركون
                  </button>
                  <div className="staff-card-tools">
                    <button
                      type="button"
                      className={`staff-icon-btn${noteOpen ? " is-active" : ""}`}
                      onClick={() => setNoteFor(noteOpen ? null : member.accountId)}
                      title="عرض الصلاحيات"
                      aria-label="عرض الصلاحيات"
                      aria-expanded={noteOpen}
                      aria-controls={noteOpen ? noteId : undefined}
                    >
                      <Icon name="visibility" />
                    </button>
                    <button
                      type="button"
                      className="staff-icon-btn"
                      onClick={() => openPassword(member)}
                      disabled={busy}
                      title="كلمة المرور"
                      aria-label="كلمة المرور"
                    >
                      <Icon name="lock_reset" />
                    </button>
                    <button
                      type="button"
                      className="staff-icon-btn"
                      onClick={() => toggleSuspended(member)}
                      disabled={busy}
                      title={suspendLabel}
                      aria-label={suspendLabel}
                    >
                      <Icon name={member.isSuspended ? "check_circle" : "block"} />
                    </button>
                    <button
                      type="button"
                      className="staff-icon-btn is-danger"
                      onClick={() => remove(member)}
                      disabled={busy}
                      title="حذف"
                      aria-label="حذف"
                    >
                      <Icon name="delete" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AdminModal
        isOpen={editor !== null}
        onClose={close}
        title={modalTitle}
        icon={editor?.mode === "password" ? "lock_reset" : "verified_user"}
        maxWidth={720}
        footer={
          <div className="staff-modal-foot">
            <button type="button" className="crm-btn-secondary" onClick={close} disabled={busy}>
              إلغاء
            </button>
            <button type="submit" form="staff-form" className="crm-btn-primary" disabled={busy}>
              {busy ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        }
      >
        <form id="staff-form" className="staff-form" onSubmit={submit}>
          {editor?.mode === "create" && (
            <section className="staff-group">
            <div className="staff-group-head">
              <span className="staff-group-icon">
                <Icon name="key" />
              </span>
              <div>
                <p className="staff-perms-title">بيانات الدخول</p>
                <p className="staff-perms-note">يستخدمها المشرف لتسجيل الدخول إلى اللوحة.</p>
              </div>
            </div>
            <div className="staff-fields">
              <label className="ui-field">
                <span className="ui-label">اسم المستخدم</span>
                <input
                  className="form-input ui-control"
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="ui-field">
                <span className="ui-label">كلمة المرور</span>
                <input
                  className="form-input ui-control"
                  type="password"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
            </div>
            </section>
          )}

          {editor?.mode === "password" && (
            <label className="ui-field">
              <span className="ui-label">كلمة المرور الجديدة</span>
              <input
                className="form-input ui-control"
                type="password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <span className="staff-perm-hint">سيُسجَّل خروج المشرف من كل أجهزته.</span>
            </label>
          )}

          {(editor?.mode === "create" || editor?.mode === "permissions") && permissionsEditor}

          {editor?.mode === "trainees" && traineePicker}
        </form>
      </AdminModal>
    </div>
  );
}
