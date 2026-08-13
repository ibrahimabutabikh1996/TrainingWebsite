"use client";
import type { JsonRecord } from "@/types";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  activityLabel,
  answerLabel,
  answerList,
  genderLabel,
  withUnit,
  EMPTY,
} from "@/lib/formLabels";
import {
  deleteAllAttachmentsAction,
  deleteAttachmentAction,
} from "@/app/admin/profile/actions";
import type { AttachmentField } from "@/app/admin/profile/attachments";
import { Icon, type IconName } from "@/components/Icon";

interface ProfileDetailsTabsProps {
  currentData: JsonRecord;
  profileId: string;
}

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
          style={{ padding: "6px 12px", fontSize: "0.8rem", background: "var(--error, #ef4444)", border: "none", color: "#fff" }}
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

export default function ProfileDetailsTabs({ currentData, profileId }: ProfileDetailsTabsProps) {
  // history is an array of objects: { label, date, data } — one entry per past month
  const history = currentData.history || [];

  // We add the current data as the latest month
  const allMonths = [
    ...history,
    {
      label: currentData.renewals?.length ? `الشهر ${currentData.renewals.length + 1}` : 'الشهر الأول',
      date: new Date().toISOString(), // we don't strictly need this for tabs
      data: currentData
    }
  ];

  const [activeIndex, setActiveIndex] = useState(allMonths.length - 1);
  const data = allMonths[activeIndex].data;

  /* The last tab is the month in progress; the earlier ones are snapshots kept
     from before each renewal, and each carries its own attachments. */
  const monthIndex = activeIndex === allMonths.length - 1 ? null : activeIndex;

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /* Deletion is permanent, so nothing goes on a single click: the button asks
     first and only the file being asked about is armed. */
  const [armed, setArmed] = useState<string | null>(null);

  const bodyPhotos: string[] = Array.isArray(data.body_photos)
    ? data.body_photos.filter((u: unknown): u is string => typeof u === "string")
    : [];
  const getFiles = (field: string): string[] => {
    return Array.isArray(data[field])
      ? (data[field] as unknown[]).filter((u): u is string => typeof u === "string")
      : typeof data[field] === "string" ? [data[field] as string] : [];
  };

  const analysisFiles = getFiles("analysis_file");
  const supplementsPhotos = getFiles("supplements_photo");
  const dietHistoryFiles = getFiles("diet_history_file");
  const homeEquipmentPhotos = getFiles("home_equipment_photo");

  const otherFilesData = [
    { field: "analysis_file", label: "ملف التحاليل", icon: "science", files: analysisFiles },
    { field: "supplements_photo", label: "صورة المكملات", icon: "medication", files: supplementsPhotos },
    { field: "diet_history_file", label: "ملف النظام السابق", icon: "receipt_long", files: dietHistoryFiles },
    { field: "home_equipment_photo", label: "معدات التمرين المنزلي", icon: "fitness_center", files: homeEquipmentPhotos },
  ] as const;

  const otherFilesCount =
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Tabs */}
      {allMonths.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
          {allMonths.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                background: activeIndex === idx ? 'var(--primary)' : 'var(--bg3)',
                color: activeIndex === idx ? '#080808' : 'var(--text-muted)',
                fontWeight: activeIndex === idx ? 'bold' : 'normal',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: '0.2s ease',
              }}
            >
              {item.label}
              {idx === allMonths.length - 1 && " (الحالي)"}
            </button>
          ))}
        </div>
      )}

      {/* 1. الأساسيات */}
      <details className="crm-modal-section" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <summary className="crm-modal-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="person" style={{ color: 'var(--primary)', fontSize: '24px' }} />
            <span style={{ fontSize: '1.2rem', color: 'var(--text)', fontWeight: 600 }}>المعلومات الأساسية</span>
          </div>
          <Icon name="expand_more" className="accordion-icon" style={{ color: 'var(--text-muted)' }} />
        </summary>
        <div style={{ marginTop: '24px' }}>
        <div className="crm-stats-grid-small" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="crm-stat-box-small">
            <span className="label">العمر</span>
            <span className="value">{withUnit(data.age, "سنة")}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">الجنس</span>
            <span className="value">{genderLabel(data.gender)}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">رقم الهاتف</span>
            <span className="value" style={{ direction: "ltr", textAlign: "right" }}>{data.phone || data.mobile || "غير مسجل"}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">السكن</span>
            <span className="value">{data.residence || EMPTY}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">حالة العمل</span>
            <span className="value">{data.employment || EMPTY}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">النشاط البدني</span>
            <span className="value" style={{ fontSize: '0.85rem' }}>{activityLabel(data.activity)}</span>
          </div>
        </div>
        </div>
      </details>

      {/* 2. المؤشرات البدنية */}
      <details className="crm-modal-section" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <summary className="crm-modal-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="monitor_weight" style={{ color: 'var(--primary)', fontSize: '24px' }} />
            <span style={{ fontSize: '1.2rem', color: 'var(--text)', fontWeight: 600 }}>المؤشرات البدنية والقياسات</span>
          </div>
          <Icon name="expand_more" className="accordion-icon" style={{ color: 'var(--text-muted)' }} />
        </summary>
        <div style={{ marginTop: '24px' }}>
        <div className="crm-stats-grid-small" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="crm-stat-box-small">
            <span className="label">الطول</span>
            <span className="value">{withUnit(data.height, "سم")}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">الوزن الحالي</span>
            <span className="value">{withUnit(data.weight, "كغم")}</span>
          </div>
          <div className="crm-stat-box-small primary-box">
            <span className="label">الوزن المستهدف</span>
            <span className="value primary-text">{withUnit(data.target_weight, "كغم")}</span>
          </div>

          {/* Measurements for females */}
          {data.gender === "female" && (
            <>
              <div className="crm-stat-box-small"><span className="label">قياس الذراع</span><span className="value">{withUnit(data.meas_arm, "سم")}</span></div>
              <div className="crm-stat-box-small"><span className="label">قياس الخصر</span><span className="value">{withUnit(data.meas_waist, "سم")}</span></div>
              <div className="crm-stat-box-small"><span className="label">قياس الحوض</span><span className="value">{withUnit(data.meas_hips, "سم")}</span></div>
              <div className="crm-stat-box-small"><span className="label">قياس الرجل</span><span className="value">{withUnit(data.meas_leg, "سم")}</span></div>
            </>
          )}
        </div>
        </div>
      </details>

      {/* 3. التغذية ونمط الحياة */}
      <details className="crm-modal-section" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <summary className="crm-modal-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="restaurant" style={{ color: 'var(--primary)', fontSize: '24px' }} />
            <span style={{ fontSize: '1.2rem', color: 'var(--text)', fontWeight: 600 }}>التغذية ونمط الحياة</span>
          </div>
          <Icon name="expand_more" className="accordion-icon" style={{ color: 'var(--text-muted)' }} />
        </summary>
        <div style={{ marginTop: '24px' }}>
        <div className="crm-stats-grid-small" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
          <div className="crm-stat-box-small" style={{ gridColumn: '1 / -1' }}>
            <span className="label">أوقات الوجبات (أيام الدوام)</span>
            <span className="value" style={{ fontSize: '0.95rem' }}>
              الريوك: {answerLabel(data.workday_breakfast)} | الغداء: {answerLabel(data.workday_lunch)} | العشاء: {answerLabel(data.workday_dinner)}
            </span>
          </div>
          <div className="crm-stat-box-small" style={{ gridColumn: '1 / -1' }}>
            <span className="label">أوقات الوجبات (أيام العطل)</span>
            <span className="value" style={{ fontSize: '0.95rem' }}>
              الريوك: {answerLabel(data.holiday_breakfast)} | الغداء: {answerLabel(data.holiday_lunch)} | العشاء: {answerLabel(data.holiday_dinner)}
            </span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">الهدف من الاشتراك</span>
            <span className="value">{answerLabel(data.sub_goal)}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">نوع اللحوم المفضل</span>
            <span className="value">{answerList(data.meat)}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">معدل القهوة اليومي</span>
            <span className="value">
              {answerLabel(data.coffee_rate)}
              {/* The type is only collected when the answer isn't "0". */}
              {data.coffee_type ? ` — ${data.coffee_type}` : ""}
            </span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">شراء المكملات</span>
            <span className="value" style={{ fontSize: '0.9rem' }}>{answerLabel(data.buy_supp)}</span>
          </div>
          <div className="crm-stat-box-small" style={{ gridColumn: '1 / -1' }}>
            <span className="label">الأكلات المفضلة</span>
            <span className="value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {data.fav_foods || "لم يذكر"}
            </span>
          </div>
          {/* Allergies stay visible even when empty — a coach must be able to
              tell "none reported" apart from "the field didn't render". */}
          <div
            className="crm-stat-box-small"
            style={{
              gridColumn: '1 / -1',
              borderInlineStart: data.allergies ? '4px solid var(--error, #ef4444)' : undefined,
            }}
          >
            <span className="label">أطعمة مستبعدة أو حساسية</span>
            <span className="value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {data.allergies || "لا يوجد"}
            </span>
          </div>
        </div>
        </div>
      </details>

      {/* 4. التمرين والالتزام */}
      <details className="crm-modal-section" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <summary className="crm-modal-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="fitness_center" style={{ color: 'var(--primary)', fontSize: '24px' }} />
            <span style={{ fontSize: '1.2rem', color: 'var(--text)', fontWeight: 600 }}>التمرين والالتزام</span>
          </div>
          <Icon name="expand_more" className="accordion-icon" style={{ color: 'var(--text-muted)' }} />
        </summary>
        <div style={{ marginTop: '24px' }}>
        <div className="crm-stats-grid-small" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="crm-stat-box-small">
            <span className="label">خبرة التمرين</span>
            <span className="value">{answerLabel(data.workout_exp)}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">نوع الخبرة</span>
            <span className="value">{answerList(data.workout_type_exp)}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">مكان الالتزام</span>
            <span className="value">{answerLabel(data.workout_commit)}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">وقت التمرين للجلسة</span>
            <span className="value">{answerLabel(data.gym_time)}</span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">عدد أيام التمرين</span>
            <span className="value">{answerLabel(data.workout_days)}</span>
          </div>
          {data.workout_type_other_desc && (
            <div className="crm-stat-box-small" style={{ gridColumn: '1 / -1' }}>
              <span className="label">ملاحظات رياضية أخرى</span>
              <span className="value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{data.workout_type_other_desc}</span>
            </div>
          )}
        </div>
        </div>
      </details>

      {/* 5. الصحة والمرفقات والتاريخ الدايت */}
      <details className="crm-modal-section" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <summary className="crm-modal-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="medical_services" style={{ color: 'var(--primary)', fontSize: '24px' }} />
            <span style={{ fontSize: '1.2rem', color: 'var(--text)', fontWeight: 600 }}>التاريخ الصحي والمرفقات</span>
          </div>
          <Icon name="expand_more" className="accordion-icon" style={{ color: 'var(--text-muted)' }} />
        </summary>
        <div style={{ marginTop: '24px' }}>
        <div className="crm-stats-grid-small" style={{ gridTemplateColumns: '1fr' }}>
          {/* Always rendered: an empty answer is itself information for the
              coach ("no injuries reported"), and hiding the row made the whole
              section look like it had failed to load. */}
          <div className="crm-stat-box-small">
            <span className="label">إصابات أو أمراض سابقة</span>
            <span className="value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {data.injuries || "لا يوجد"}
            </span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">المكملات المستخدمة حالياً</span>
            <span className="value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {data.supplements_list || "لا يوجد"}
            </span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">تاريخ الدايت والأنظمة السابقة</span>
            <span className="value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {data.diet_history || "لا يوجد"}
            </span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">نوع الدايت الأخير وسبب فشله</span>
            <span className="value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {data.last_diet_fail || "لا يوجد"}
            </span>
          </div>
          <div className="crm-stat-box-small">
            <span className="label">سبب تناول الطعام بكميات كبيرة أو قليلة</span>
            <span className="value" style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {data.eating_reason || "لا يوجد"}
            </span>
          </div>

          {/* Files Section */}
          {/* Files Section */}
          {otherFilesCount > 0 && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
              {otherFilesData.map(({ field, label, icon, files }) =>
                files.map((url, idx) => (
                  <div
                    key={url}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px 6px 6px',
                      borderRadius: 12,
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="crm-btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.95rem', textDecoration: 'none', background: 'transparent', color: 'var(--text)', border: 'none' }}
                    >
                      <Icon name={icon as any} style={{ fontSize: '20px' }} />
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
            <p style={{ margin: '16px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              لا توجد مرفقات لهذا الشهر.
            </p>
          )}

          {/* Clearing the lot at once, for when the coach no longer needs any of it. */}
          {attachmentCount > 1 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
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
        </div>
      </details>
      
      {/* 6. التطور الجسدي (صور المشترك) */}
      {bodyPhotos.length > 0 && (
        <details className="crm-modal-section crm-modal-gallery" style={{ background: 'var(--bg2)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border)', marginTop: '16px' }}>
          <summary className="crm-modal-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="photo_library" style={{ color: 'var(--primary)', fontSize: '24px' }} />
              <span style={{ fontSize: '1.2rem', color: 'var(--text)', fontWeight: 600 }}>صور المشترك (التطور الجسدي)</span>
            </div>
            <Icon name="expand_more" className="accordion-icon" style={{ color: 'var(--text-muted)' }} />
          </summary>
          <div className="crm-gallery-scroll" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '24px' }}>
            {bodyPhotos.map((url, idx) => (
              <div key={url} className="crm-gallery-item" style={{ width: '100%', position: 'relative' }}>
                <a href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`صورة ${idx + 1}`} loading="lazy" style={{ width: '100%', height: '280px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border)', transition: '0.3s ease' }} />
                </a>
                {/* Sits over the photo it deletes, so there is no chance of the
                    coach confirming against the wrong one. */}
                <div
                  style={{
                    position: 'absolute',
                    insetInlineEnd: 10,
                    insetBlockStart: 10,
                    display: 'flex',
                    gap: 6,
                    padding: 4,
                    borderRadius: 10,
                    background: 'color-mix(in srgb, var(--bg2) 85%, transparent)',
                    backdropFilter: 'blur(4px)',
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
            ))}
          </div>
        </details>
      )}

    </div>
  );
}
