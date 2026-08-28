"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  deleteAllAttachmentsAction,
  deleteAttachmentAction,
} from "@/app/admin/profile/actions";
import type { AttachmentField } from "@/app/admin/profile/attachments";
import type { PlanNames } from "@/lib/planNames";
import {
  monthGroups,
  answeredCount,
  monthWeight,
  type SubscriptionMonth,
} from "@/lib/subscriptionMonths";
import { Icon, type IconName } from "@/components/Icon";
import { attachmentSrc } from "@/lib/attachments";

/* Ask, then do — deletion here is permanent, so no single click performs one.
   Defined at module level: nested inside the component it would be a new
   component type on every render, and React would tear down and rebuild the
   button each time, losing the very confirm state it exists to hold. */
function DeleteControl({
  id,
  armed,
  setArmed,
  pending,
  onConfirm,
  title,
}: {
  id: string;
  armed: string | null;
  setArmed: (id: string | null) => void;
  pending: boolean;
  onConfirm: () => void;
  title: string;
}) {
  if (armed === id) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="crm-btn-primary"
          style={{ padding: "6px 12px", fontSize: "0.8rem", background: "var(--error)", border: "none", color: "var(--text-inverse)" }}
        >
          {pending ? "جارٍ الحذف..." : "تأكيد الحذف نهائياً"}
        </button>
        <button
          type="button"
          onClick={() => setArmed(null)}
          disabled={pending}
          className="crm-btn-primary"
          style={{ padding: "6px 12px", fontSize: "0.8rem", background: "var(--bg4)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          تراجع
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setArmed(id)}
      disabled={pending}
      title={title}
      aria-label={title}
      style={{
        display: "inline-grid",
        placeItems: "center",
        padding: 6,
        borderRadius: 8,
        background: "var(--bg4)",
        border: "1px solid var(--border)",
        color: "var(--text-muted)",
        cursor: pending ? "not-allowed" : "pointer",
      }}
    >
      <Icon name="delete_forever" style={{ fontSize: 18 }} />
    </button>
  );
}

const arDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" }) : null;

/**
 * One month, standing on its own.
 *
 * Each month keeps its own confirm state and its own `monthIndex`, because they
 * are all on the page at once now: a delete armed in the third month must not
 * light up the same button in the first, and the action has to be told which
 * snapshot it is editing.
 */
export function MonthSection({
  month,
  monthIndex,
  profileId,
  planNames,
}: {
  month: SubscriptionMonth;
  /** Index into `history`, or null for the month still running. */
  monthIndex: number | null;
  profileId: string;
  planNames: PlanNames;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /* Deletion is permanent, so nothing goes on a single click: the button asks
     first and only the file being asked about is armed. */
  const [armed, setArmed] = useState<string | null>(null);

  const groups = monthGroups(month, { planNames });
  const answered = answeredCount(groups);
  const weight = monthWeight(month, { planNames });

  const data = month.data;

  const bodyPhotos: string[] = Array.isArray(data.body_photos)
    ? data.body_photos.filter((u: unknown): u is string => typeof u === "string")
    : [];
  const getFiles = (field: string): string[] => {
    return Array.isArray(data[field])
      ? (data[field] as unknown[]).filter((u): u is string => typeof u === "string")
      : typeof data[field] === "string" ? [data[field] as string] : [];
  };

  const paymentReceipts = getFiles("payment_receipt");
  const analysisFiles = getFiles("analysis_file");
  const supplementsPhotos = getFiles("supplements_photo");
  const dietHistoryFiles = getFiles("diet_history_file");
  const homeEquipmentPhotos = getFiles("home_equipment_photo");

  const otherFilesData = [
    /* First in the list on purpose: it is the one attachment the coach looks for
       before anything else, since it is what says the month was paid for. */
    { field: "payment_receipt", label: "وصل الدفع", icon: "payments", files: paymentReceipts },
    { field: "analysis_file", label: "ملف التحاليل", icon: "science", files: analysisFiles },
    { field: "supplements_photo", label: "صورة المكملات", icon: "medication", files: supplementsPhotos },
    { field: "diet_history_file", label: "ملف النظام السابق", icon: "receipt_long", files: dietHistoryFiles },
    { field: "home_equipment_photo", label: "معدات التمرين المنزلي", icon: "fitness_center", files: homeEquipmentPhotos },
  ] as const;

  const otherFilesCount =
    paymentReceipts.length +
    analysisFiles.length + supplementsPhotos.length + dietHistoryFiles.length + homeEquipmentPhotos.length;
  const attachmentCount = bodyPhotos.length + otherFilesCount;

  const removeOne = (field: AttachmentField, url: string, label: string) => {
    setArmed(null);
    startTransition(async () => {
      const res = await deleteAttachmentAction({ profileId, field, url, monthIndex });
      if (res.success) {
        toast.success(`حُذف ${label} نهائياً`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const removeAll = () => {
    setArmed(null);
    startTransition(async () => {
      const res = await deleteAllAttachmentsAction(profileId, monthIndex);
      if (res.success) {
        toast.success("حُذفت كل مرفقات هذا الشهر نهائياً");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const from = arDate(month.startDate);
  const to = arDate(month.endDate);

  return (
    <details
      className="crm-modal-section"
      style={{
        background: "var(--bg2)",
        padding: "24px",
        borderRadius: "var(--radius-xl)",
        /* `--border-strong`, not `--border`.
           `--border` is #162235 and this sits on `--bg2` #15212E — seven units
           apart, in the blue channel alone, so the outline of the tab was very
           nearly the colour of what it was drawn on. `--border-strong` (#22334D)
           already exists in the token set for the borders that have to be seen;
           the three tabs of a month share it, and nothing outside them does. */
        border: "1px solid var(--border-strong)",
      }}
      /* Neither the primary-coloured border nor `open={month.isCurrent}` is here
         any more, and both were right when they were written: the months were
         drawn as one list, and the one in progress had to be picked out of it.
         Each of these now stands alone inside its own month of the timeline,
         beside the lifted weights and the weigh-in chart — so "current" marks it
         out from nothing, while making it look unlike the two tabs it sits with.
         The `الحالي` badge in the summary still says which month this is.
         All three tabs start closed, so opening a month gives a short list
         rather than a wall. */
    >
      <summary
        className="crm-modal-section-title"
        style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", minWidth: 0 }}>
          <Icon name="calendar_month" style={{ color: "var(--primary)", fontSize: "24px" }} />
          <span style={{ fontSize: "1.2rem", color: "var(--text)", fontWeight: 700 }}>{month.label}</span>
          {month.isCurrent && (
            <span className="crm-tag primary-tag" style={{ fontSize: "0.8rem", padding: "2px 10px", borderRadius: "var(--radius-lg)" }}>
              الحالي
            </span>
          )}
          {weight && (
            <span className="crm-tag" style={{ fontSize: "0.8rem", padding: "2px 10px", borderRadius: "var(--radius-lg)" }}>
              {weight}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="crm-tag" style={{ fontSize: "0.8rem", padding: "2px 10px", borderRadius: "var(--radius-lg)" }}>
              {attachmentCount} مرفقاً
            </span>
          )}
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
            {from && to ? `${from} — ${to}` : from ? `من ${from}` : `${answered} إجابة`}
          </span>
        </div>
        <Icon name="expand_more" className="accordion-icon" style={{ color: "var(--text-muted)" }} />
      </summary>

      <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "28px" }}>
        {groups.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            لا توجد إجابات محفوظة لهذا الشهر.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.id}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                <Icon name={group.icon as IconName} style={{ color: "var(--primary)", fontSize: "20px" }} />
                <span style={{ fontSize: "1.02rem", color: "var(--text)", fontWeight: 700 }}>{group.title}</span>
              </div>
              <div className="crm-stats-grid-small" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {group.fields.map((f) => (
                  <div key={f.key} className="crm-stat-box-small">
                    <span className="label">{f.label}</span>
                    <span className="value" style={{ fontSize: "0.95rem", whiteSpace: "pre-wrap" }}>{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* That month's attachments, with that month's own delete target. */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
            <Icon name="inventory_2" style={{ color: "var(--primary)", fontSize: "20px" }} />
            <span style={{ fontSize: "1.02rem", color: "var(--text)", fontWeight: 700 }}>المرفقات</span>
          </div>

          {otherFilesCount > 0 && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {otherFilesData.map(({ field, label, icon, files }) =>
                files.map((url, idx) => (
                  <div
                    key={url}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px 6px 6px",
                      borderRadius: 12,
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <a
                      /* Never the stored string. It is a path inside a private
                         bucket — `usersData/<session>/…` — and a browser reads
                         a value with no scheme and no leading slash as relative
                         to the current page, so this asked for
                         /admin/profile/<id>/usersData/… and got a 404.
                         `attachmentSrc` turns it into a request the attachments
                         route authorises and answers with a short-lived signed
                         URL. */
                      href={attachmentSrc(url) ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="crm-btn-primary"
                      style={{ padding: "8px 14px", fontSize: "0.95rem", textDecoration: "none", background: "transparent", color: "var(--text)", border: "none" }}
                    >
                      <Icon name={icon} style={{ fontSize: "20px" }} />
                      {label} {files.length > 1 ? idx + 1 : ""}
                    </a>
                    <DeleteControl
                      armed={armed}
                      setArmed={setArmed}
                      pending={pending}
                      id={`file:${field}_${idx}`}
                      title={`حذف ${label} نهائياً`}
                      onConfirm={() => removeOne(field as AttachmentField, url, `${label} ${files.length > 1 ? idx + 1 : ""}`)}
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {attachmentCount === 0 && (
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
              لا توجد مرفقات لهذا الشهر.
            </p>
          )}

          {/* Clearing the lot at once, for when the coach no longer needs any of it. */}
          {attachmentCount > 1 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                {attachmentCount} مرفقاً في هذا الشهر. الحذف نهائي: يُمسح الملف من الموقع ومن قاعدة البيانات ولا يمكن التراجع عنه.
              </span>
              <DeleteControl
                armed={armed}
                setArmed={setArmed}
                pending={pending}
                id="all"
                title="حذف كل مرفقات هذا الشهر نهائياً"
                onConfirm={removeAll}
              />
            </div>
          )}
        </div>

        {bodyPhotos.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
              <Icon name="photo_library" style={{ color: "var(--primary)", fontSize: "20px" }} />
              <span style={{ fontSize: "1.02rem", color: "var(--text)", fontWeight: 700 }}>صور التطور الجسدي</span>
            </div>
            <div className="crm-gallery-scroll" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "20px" }}>
              {bodyPhotos.map((url, idx) => {
                /* Rendered only once the stored value resolves to an address we
                   recognise: a path becomes a request to the authorising
                   reader, and anything else becomes null and is not drawn at
                   all, rather than becoming a broken image pointing wherever
                   the string happened to say. */
                const src = attachmentSrc(url);
                return (
                <div key={url} className="crm-gallery-item" style={{ width: "100%", position: "relative" }}>
                  {src && (
                    <a href={src} target="_blank" rel="noreferrer">
                      <img src={src} alt={`صورة ${idx + 1}`} loading="lazy" style={{ width: "100%", height: "280px", objectFit: "cover", borderRadius: "12px", border: "1px solid var(--border)" }} />
                    </a>
                  )}
                  {/* Sits over the photo it deletes, so there is no chance of the
                      coach confirming against the wrong one. */}
                  <div
                    style={{
                      position: "absolute",
                      insetInlineEnd: 10,
                      insetBlockStart: 10,
                      display: "flex",
                      gap: 6,
                      padding: 4,
                      borderRadius: 10,
                      background: "color-mix(in srgb, var(--bg2) 85%, transparent)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <DeleteControl
                      armed={armed}
                      setArmed={setArmed}
                      pending={pending}
                      id={`photo:${url}`}
                      title={`حذف الصورة ${idx + 1} نهائياً`}
                      onConfirm={() => removeOne("body_photos", url, `الصورة ${idx + 1}`)}
                    />
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

/* The default export that stood here — "سجل الأشهر", every month of the
   subscription listed one after another — is gone. Its months now live one per
   tab inside the timeline, where each sits beside that month's lifted weights
   and weigh-ins; a second list of all of them below the page was the same
   record read a second way. `MonthSection` above is what survived it, and the
   timeline is its only caller. */
