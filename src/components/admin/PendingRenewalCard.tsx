"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { rejectRenewalAction } from "@/app/admin/profile/actions";
import { attachmentSrc } from "@/lib/attachments";
import { planNameFrom, type PlanNames } from "@/lib/planNames";
import { formatTimestamp } from "@/lib/trainingDates";
import { Icon } from "@/components/Icon";
import type { JsonRecord } from "@/types";

/* The coach's half of a renewal.
 *
 * The flow it completes was built from both ends and never joined in the
 * middle. /api/submit-form records the trainee's request — it archives the
 * closing month, raises `renewal_pending`, and deliberately grants not one day,
 * because the only payment check this system has is the coach opening the
 * transfer slip. /api/admin/renew-account grants the month and clears the flag.
 * Between them there was nothing: no screen read `renewal_pending`, and a
 * search of every fetch in the project found no caller for the approval route
 * at all. So a trainee could ask, the coach could be notified, and the
 * subscription would never be extended by any means.
 *
 * This is that missing middle, and it is deliberately the only place the two
 * decisions are offered together — approve and reject side by side, with what
 * was paid and what was asked for on screen between them.
 */

interface Props {
  profileId: string;
  /** The live intake blob. Read for the three flags and the receipt. */
  data: JsonRecord;
  planNames: PlanNames;
}

function receiptsFrom(data: JsonRecord): string[] {
  const value = data.payment_receipt;
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return typeof value === "string" && value ? [value] : [];
}

export default function PendingRenewalCard({ profileId, data, planNames }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [approving, setApproving] = useState(false);
  /* Neither decision happens on a single click. Approving hands over a paid
     month and rejecting closes a request the trainee is waiting on, and this
     panel gets left open on a screen. */
  const [armed, setArmed] = useState<"approve" | "reject" | null>(null);

  /* Nothing to review. The flag is the whole condition: it is raised by the
     submission and cleared by either decision, so its absence means there is no
     open request — whatever the subscription dates happen to say. */
  if (data.renewal_pending !== true) return null;

  const monthNumber =
    typeof data.renewal_requested_month === "number" ? data.renewal_requested_month : null;
  const requestedAt =
    typeof data.renewal_requested_at === "string" ? data.renewal_requested_at : null;
  const planName = planNameFrom(planNames, data.plan, "غير محدد");
  const receipts = receiptsFrom(data);
  const busy = pending || approving;

  const approve = async () => {
    setArmed(null);
    setApproving(true);
    try {
      const res = await fetch("/api/admin/renew-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "حدث خطأ أثناء تجديد الاشتراك");
        return;
      }
      toast.success("تم تجديد الاشتراك وإضافة الشهر الجديد");
      /* The month lands on the row this page was rendered from, so the server
         component has to run again for the timeline, the account card and this
         card's own disappearance to agree with it. */
      router.refresh();
    } catch {
      toast.error("حدث خطأ في الاتصال بالخادم");
    } finally {
      setApproving(false);
    }
  };

  const reject = () => {
    setArmed(null);
    startTransition(async () => {
      const res = await rejectRenewalAction(profileId);
      if (res.success) {
        toast.success("رُفض الطلب. لم تُحتسب أي أيام، ويمكن للمتدرب إرسال طلب جديد.");
        router.refresh();
      } else {
        toast.error(res.error || "حدث خطأ أثناء رفض الطلب");
      }
    });
  };

  return (
    <div
      className="crm-modal-section"
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--warning) 14%, var(--bg2)), var(--bg2))",
        border: "1px solid color-mix(in srgb, var(--warning) 45%, var(--border))",
        borderInlineStart: "5px solid var(--warning)",
        borderRadius: "var(--radius-xl)",
        padding: "24px 28px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "var(--radius-xl)",
            background: "color-mix(in srgb, var(--warning) 22%, var(--bg3))",
            color: "var(--warning-text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="hourglass" style={{ fontSize: 28 }} />
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <h3
            style={{
              margin: "0 0 6px 0",
              fontSize: "1.25rem",
              fontWeight: 800,
              color: "var(--text)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span>طلب تجديد اشتراك بانتظار المراجعة</span>
            {monthNumber && (
              <span
                style={{
                  fontSize: "0.78rem",
                  background: "var(--warning)",
                  color: "#1a1a1a",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-pill)",
                  fontWeight: 800,
                }}
              >
                الشهر {monthNumber}
              </span>
            )}
          </h3>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
            أرسل المتدرب استمارة الشهر الجديد وأرفق وصل الدفع. راجع الوصل وبياناته أدناه،
            ثم وافق ليُضاف الشهر إلى اشتراكه. <b>لا تُحتسب أي أيام قبل موافقتك.</b>
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
        }}
      >
        <Fact label="الخطة المطلوبة" value={planName} icon="label" />
        <Fact label="الشهر المطلوب" value={monthNumber ? `الشهر ${monthNumber}` : "غير محدد"} icon="event_note" />
        <Fact label="تاريخ الطلب" value={requestedAt ? formatTimestamp(requestedAt) : "غير محدد"} icon="schedule" />
      </div>

      {/* The receipt is the review. Everything else on this card is context. */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "10px",
            color: "var(--text-secondary)",
            fontWeight: 700,
            fontSize: "0.95rem",
          }}
        >
          <Icon name="payments" style={{ fontSize: 20 }} />
          <span>وصل الدفع المرفق</span>
        </div>
        {receipts.length === 0 ? (
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            لا يوجد وصل مرفق مع هذا الطلب.
          </p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {receipts.map((ref, i) => {
              /* Never the stored string straight into `href`. `attachmentSrc`
                 turns a storage path into a request the attachments route
                 authorises, passes a legacy public URL through, and returns null
                 for anything else — so a value that is neither is not rendered
                 as a link at all. */
              const href = attachmentSrc(ref);
              if (!href) return null;
              return (
                <a
                  key={`${ref}-${i}`}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="crm-btn-primary"
                  style={{
                    padding: "10px 18px",
                    fontSize: "0.9rem",
                    textDecoration: "none",
                    background: "var(--bg3)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Icon name="visibility" style={{ fontSize: 18 }} />
                  <span>{receipts.length > 1 ? `فتح الوصل ${i + 1}` : "فتح الوصل"}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        {armed === "approve" ? (
          <>
            <button
              type="button"
              onClick={approve}
              disabled={busy}
              className="crm-btn-primary"
              style={{ padding: "12px 22px", fontSize: "0.95rem", background: "var(--success)", border: "none", color: "var(--text-inverse)" }}
            >
              <Icon name="check_circle" style={{ fontSize: 20 }} />
              <span>{busy ? "جارٍ التجديد..." : "تأكيد — أضف الشهر"}</span>
            </button>
            <button
              type="button"
              onClick={() => setArmed(null)}
              disabled={busy}
              className="crm-btn-primary"
              style={{ padding: "12px 18px", fontSize: "0.9rem", background: "var(--bg3)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              تراجع
            </button>
          </>
        ) : armed === "reject" ? (
          <>
            <button
              type="button"
              onClick={reject}
              disabled={busy}
              className="crm-btn-primary"
              style={{ padding: "12px 22px", fontSize: "0.95rem", background: "var(--error)", border: "none", color: "var(--text-inverse)" }}
            >
              <Icon name="block" style={{ fontSize: 20 }} />
              <span>{busy ? "جارٍ الرفض..." : "تأكيد الرفض"}</span>
            </button>
            <button
              type="button"
              onClick={() => setArmed(null)}
              disabled={busy}
              className="crm-btn-primary"
              style={{ padding: "12px 18px", fontSize: "0.9rem", background: "var(--bg3)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              تراجع
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setArmed("approve")}
              disabled={busy}
              className="crm-btn-primary"
              style={{ padding: "12px 24px", fontSize: "0.98rem", fontWeight: 800, background: "var(--success)", border: "none", color: "var(--text-inverse)" }}
            >
              <Icon name="verified" style={{ fontSize: 20 }} />
              <span>موافقة وتجديد الاشتراك</span>
            </button>
            <button
              type="button"
              onClick={() => setArmed("reject")}
              disabled={busy}
              className="crm-btn-primary"
              style={{ padding: "12px 20px", fontSize: "0.92rem", background: "var(--bg3)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              <Icon name="close" style={{ fontSize: 18 }} />
              <span>رفض الطلب</span>
            </button>
          </>
        )}
      </div>

      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
        الموافقة تضيف <b>٣٠ يوماً</b> فوق ما تبقّى من اشتراكه الحالي — لا تُلغى الأيام المتبقية.
        والرفض يغلق الطلب دون أن يسحب يوماً واحداً، ويسمح للمتدرب بإرسال طلب مصحّح.
      </p>
    </div>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon: "label" | "event_note" | "schedule" }) {
  return (
    <div
      style={{
        background: "var(--bg3)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "var(--text-muted)",
          fontSize: "0.78rem",
          marginBottom: "6px",
        }}
      >
        <Icon name={icon} style={{ fontSize: 16 }} />
        <span>{label}</span>
      </div>
      <div style={{ color: "var(--text)", fontWeight: 700, fontSize: "0.95rem", overflowWrap: "anywhere" }}>
        {value}
      </div>
    </div>
  );
}
