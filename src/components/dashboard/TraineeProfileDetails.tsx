"use client";

import React from "react";
import type { UserProfile } from "@/types";
import { Icon, type IconName } from "@/components/Icon";
import { attachmentSrc } from "@/lib/attachments";
import {
  activityLabel,
  answerLabel,
  answerList,
  genderLabel,
  withUnit,
} from "@/lib/formLabels";
import { planNameFrom } from "@/lib/planNames";
import { usePlanNames } from "@/hooks/usePlanNames";

interface TraineeProfileDetailsProps {
  profile: UserProfile;
}

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: IconName;
  dir?: "rtl" | "ltr";
  highlight?: boolean;
  alertColor?: "red" | "orange";
  fullWidth?: boolean;
  extraTag?: React.ReactNode;
}

function MetricCard({
  label,
  value,
  icon,
  dir = "rtl",
  highlight = false,
  alertColor,
  fullWidth = false,
  extraTag,
}: MetricCardProps) {
  /* The card and its icon tile come from the Lit Glass classes; the tone is a
     class on the card, so the edge, the tile and the label all follow it.
     Hover is the card's own edge light — cards never move. */
  const textColor = "var(--text)";
  const isToned = highlight || Boolean(alertColor);
  const labelColor = isToned ? "var(--primary-on-tint)" : "var(--text-muted)";
  const toneClass = alertColor === "red" ? " tone-danger" : alertColor === "orange" ? " tone-warning" : "";

  return (
    <div
      className={`ui-card${isToned ? " ui-card--featured" : ""}${toneClass}`}
      style={{
        gridColumn: fullWidth ? "1 / -1" : "auto",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {icon && (
            <div className="ui-icon-tile ui-icon-tile--sm">
              <Icon name={icon} />
            </div>
          )}
          <span style={{ fontSize: "0.9rem", color: labelColor, fontWeight: 700 }}>
            {label}
          </span>
        </div>
        {extraTag}
      </div>
      <span
        style={{
          fontSize: "1.1rem",
          fontWeight: 800,
          color: textColor,
          direction: dir,
          textAlign: dir === "ltr" ? "right" : "inherit",
          whiteSpace: fullWidth ? "pre-wrap" : "normal",
          lineHeight: 1.6,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function TraineeProfileDetails({ profile }: TraineeProfileDetailsProps) {
  /* The coach's names for the packages — see the hook for why this screen asks
     for them rather than being handed them. */
  const planNames = usePlanNames();
  const data = profile.raw_answers || {};

  const getFiles = (val: unknown): string[] => {
    if (Array.isArray(val)) {
      return val.filter((u): u is string => typeof u === "string" && Boolean(u));
    }
    if (typeof val === "string" && Boolean(val.trim())) {
      return [val];
    }
    return [];
  };

  const paymentReceipts = getFiles(data.payment_receipt);
  const analysisFiles = getFiles(data.analysis_file);
  const supplementsPhotos = getFiles(data.supplements_photo);
  const dietHistoryFiles = getFiles(data.diet_history_file);
  const bodyPhotos = getFiles(data.body_photos);

  /* Typed at the list rather than cast at the point of use: the three icon
     names are checked against IconName here, so a typo is an error on the line
     that has it instead of an `as any` further down hiding it. */
  const fileGroups: { label: string; icon: IconName; files: string[] }[] = [
    { label: "وصل الدفع", icon: "payments", files: paymentReceipts },
    { label: "ملف التحاليل والفحوصات الطبية", icon: "science", files: analysisFiles },
    { label: "صور المكملات الغذائية", icon: "medication", files: supplementsPhotos },
    { label: "ملف النظام الغذائي والتدريبي السابق", icon: "receipt_long", files: dietHistoryFiles },
  ];
  const otherFiles = fileGroups.filter((group) => group.files.length > 0);

  const currentWeightNum = parseFloat(String(data.weight || profile.weight || "").replace(/[^0-9.]/g, ""));
  const targetWeightNum = parseFloat(String(data.target_weight || "").replace(/[^0-9.]/g, ""));
  let weightGoalBadge = null;
  if (!isNaN(currentWeightNum) && !isNaN(targetWeightNum) && currentWeightNum > 0 && targetWeightNum > 0) {
    const diff = targetWeightNum - currentWeightNum;
    if (diff < 0) {
      weightGoalBadge = (
        <span className="ui-badge tone-success">
          هدف نزول {Math.abs(diff).toFixed(1)} كغم
        </span>
      );
    } else if (diff > 0) {
      weightGoalBadge = (
        <span className="ui-badge">
          هدف زيادة {diff.toFixed(1)} كغم
        </span>
      );
    } else {
      weightGoalBadge = (
        <span className="ui-badge">
          الحفاظ على الوزن المثالي
        </span>
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, animation: "fadeIn 0.4s ease" }}>
      {/* 1. Overview & Subscription Plan Summary */}
      <section
        className="dashboard-card ui-card--featured"
        style={{
          padding: "32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px", borderBottom: "1px solid var(--border)", paddingBottom: "20px", flexWrap: "wrap" }}>
          <div className="ui-icon-tile ui-icon-tile--lg ui-icon-tile--lit">
            <Icon name="verified" />
          </div>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>بيانات الاشتراك والهدف التدريبي</h2>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
          <MetricCard
            label="الاسم المسجل في المنصة"
            value={data.fullname || profile.fullname || "—"}
            icon="person"
          />
          <div
            className="ui-card ui-card--featured"
            style={{
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 700 }}>الخطة المشترك بها</span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Icon name="workspace_premium" style={{ color: "var(--primary)", fontSize: "28px" }} />
              <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--primary)" }}>{planNameFrom(planNames, data.plan || profile.plan, "خطة التدريب والمتابعة")}</span>
            </div>
          </div>
          <MetricCard
            label="الهدف الأساسي من الاشتراك"
            value={answerLabel(data.sub_goal || data.goal || profile.goal, "لم تتم الإجابة")}
            icon="emoji_events"
          />
        </div>
      </section>

      {/* 2. Basic Personal Information */}
      <section className="dashboard-card" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div className="ui-icon-tile">
            <Icon name="person_search" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>المعلومات والبيانات الشخصية</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <MetricCard label="العمر" value={withUnit(data.age || profile.age, "سنة", "—")} icon="calendar_today" />
          <MetricCard label="الجنس" value={genderLabel(data.gender || profile.gender, "—")} icon="person" />
          <MetricCard label="رقم الهاتف" value={data.phone || data.mobile || "غير مسجل"} icon="phone" dir="ltr" />
          <MetricCard label="مكان السكن / الدولة" value={data.residence || "—"} icon="web" />
          <MetricCard label="الحالة المهنية / طبيعة العمل" value={data.employment || "—"} icon="badge" />
          <MetricCard label="مستوى النشاط البدني" value={activityLabel(data.activity || profile.activity, "غير محدد")} icon="monitoring" />
        </div>
      </section>

      {/* 3. Physical Metrics & Measurements */}
      <section className="dashboard-card" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div className="ui-icon-tile">
            <Icon name="activity" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>المؤشرات البدنية والقياسات الجسدية</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <MetricCard label="الطول" value={withUnit(data.height || profile.height, "سم", "—")} icon="ruler" />
          <MetricCard label="الوزن عند بداية التسجيل" value={withUnit(data.weight || profile.weight, "كغم", "—")} icon="gauge" />
          <MetricCard
            label="الوزن المستهدف (الهدف)"
            value={withUnit(data.target_weight, "كغم", "لم يحدد")}
            icon="emoji_events"
            highlight
            extraTag={weightGoalBadge}
          />

          {(data.gender === "female" || profile.gender === "female") && (
            <>
              <MetricCard label="قياس الذراع" value={withUnit(data.meas_arm, "سم", "—")} icon="ruler" />
              <MetricCard label="قياس الخصر" value={withUnit(data.meas_waist, "سم", "—")} icon="ruler" />
              <MetricCard label="قياس الحوض" value={withUnit(data.meas_hips, "سم", "—")} icon="ruler" />
              <MetricCard label="قياس الرجل / الفخذ" value={withUnit(data.meas_leg, "سم", "—")} icon="ruler" />
            </>
          )}
        </div>
      </section>

      {/* 4. Nutrition & Lifestyle */}
      <section className="dashboard-card" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div className="ui-icon-tile">
            <Icon name="restaurant" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>التغذية ونمط الحياة التفضيلية</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          {/* Preferred Meal Times - Workdays */}
          <div className="ui-card" style={{ gridColumn: "1 / -1", padding: "22px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
              <Icon name="schedule" style={{ color: "var(--primary)", fontSize: "24px" }} />
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>أوقات الوجبات المفضلة (أيام العمل والدوام)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
              <div className="tpd-meal-slot" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>الريوك (الفطور)</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.workday_breakfast, "—")}</span>
              </div>
              <div className="tpd-meal-slot" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>الغداء</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.workday_lunch, "—")}</span>
              </div>
              <div className="tpd-meal-slot" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>العشاء</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.workday_dinner, "—")}</span>
              </div>
            </div>
          </div>

          {/* Preferred Meal Times - Holidays */}
          <div className="ui-card" style={{ gridColumn: "1 / -1", padding: "22px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
              <Icon name="event_available" style={{ color: "var(--primary)", fontSize: "24px" }} />
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>أوقات الوجبات المفضلة (أيام العطل والإجازات)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
              <div className="tpd-meal-slot" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>الريوك (الفطور)</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.holiday_breakfast, "—")}</span>
              </div>
              <div className="tpd-meal-slot" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>الغداء</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.holiday_lunch, "—")}</span>
              </div>
              <div className="tpd-meal-slot" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>العشاء</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.holiday_dinner, "—")}</span>
              </div>
            </div>
          </div>

          <MetricCard label="أنواع اللحوم المفضلة" value={answerList(data.meat, "—")} icon="restaurant_menu" />
          <MetricCard label="معدل استهلاك القهوة" value={`${answerLabel(data.coffee_rate, "لم تتم الإجابة")}${data.coffee_type ? ` — (${data.coffee_type})` : ""}`} icon="bakery_dining" />
          <MetricCard label="شراء المكملات الغذائية" value={answerLabel(data.buy_supp, "—")} icon="medication" />
          <MetricCard label="الأكلات والوجبات المفضلة" value={data.fav_foods || "لم تتم الإجابة"} icon="restaurant" fullWidth />
          <MetricCard
            label="أطعمة مستبعدة أو حساسية غذائية"
            value={data.allergies || "لم تتم الإجابة"}
            icon="warning"
            alertColor={data.allergies ? "red" : undefined}
            fullWidth
          />
          <MetricCard label="المكملات الغذائية المستخدمة حالياً" value={data.supplements_list || "لا يوجد"} icon="medication" fullWidth />
          <MetricCard label="تاريخ الدايت والأنظمة الغذائية السابقة" value={data.diet_history || "لا يوجد"} icon="receipt_long" fullWidth />
        </div>
      </section>

      {/* 5. Training Background & Commitment */}
      <section className="dashboard-card" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div className="ui-icon-tile">
            <Icon name="fitness_center" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>التمرين والالتزام الرياضي</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <MetricCard label="خبرة التمرين السابقة" value={answerLabel(data.workout_exp, "لم تتم الإجابة")} icon="military_tech" />
          <MetricCard label="نوع الرياضة أو الخبرة" value={answerList(data.workout_type_exp, "لم تتم الإجابة")} icon="exercise" />
          <MetricCard label="مكان الالتزام بالتمرين" value={answerLabel(data.workout_commit || data.place, "—")} icon="home" />
          {data.workout_commit !== "opt_commit_home" && <MetricCard label="الوقت المفضل لتأدية التمرين" value={answerLabel(data.gym_time, "لم تتم الإجابة")} icon="schedule" />}
          <MetricCard label="عدد أيام التمرين المقررة" value={answerLabel(data.workout_days || data.days, "—")} icon="calendar_month" />

          {data.workout_type_other_desc && (
            <MetricCard label="ملاحظات وتفاصيل رياضية أخرى" value={data.workout_type_other_desc} icon="description" fullWidth />
          )}

          <MetricCard
            label="إصابات رياضية أو أمراض أو حالات صحية سابقة"
            value={data.injuries || "سليم ولله الحمد (لا توجد إصابات أو حالات مرضية)"}
            icon="report_problem"
            alertColor={data.injuries ? "orange" : undefined}
            fullWidth
          />
        </div>
      </section>

      {/* 6. Attached Documents & Medical Reports */}
      <section className="dashboard-card" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div className="ui-icon-tile">
            <Icon name="medical_services" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>الملفات والمرفقات الطبية والتحاليل</h2>
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", margin: "4px 0 0" }}>الملفات والتقارير والصور الطبية التي قمت بإرفاقها أثناء التسجيل</p>
          </div>
        </div>

        {otherFiles.length > 0 ? (
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "8px" }}>
            {otherFiles.map(({ label, icon, files }) =>
              files.map((url, idx) => (
                <a
                  key={url}
                  /* The stored value is a path inside a private bucket, not an
                     address: put straight into `href` a browser resolves it
                     against the current page and lands on a 404. `attachmentSrc`
                     points it at the reader that authorises and signs. */
                  href={attachmentSrc(url) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="ui-btn ui-btn--secondary"
                  style={{
                    whiteSpace: "normal",
                    gap: "10px",
                  }}
                >
                  <Icon name={icon} style={{ fontSize: "22px", color: "var(--primary)" }} />
                  <span>{label} {files.length > 1 ? `(${idx + 1})` : ""}</span>
                  <Icon name="open_in_new" style={{ fontSize: "18px", opacity: 0.7 }} />
                </a>
              ))
            )}
          </div>
        ) : (
          <div className="ui-empty" style={{ padding: "30px" }}>
            <Icon name="folder_off" />
            <span>لم تقم بإرفاق ملفات تحاليل طبية أو تقارير أنظمة سابقة عند بدء الاشتراك.</span>
          </div>
        )}
      </section>

      {/* 7. Body Transformation Photos Gallery */}
      <section className="dashboard-card" style={{ padding: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div className="ui-icon-tile">
            <Icon name="photo_library" />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>صور التطور الجسدي</h2>
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", margin: "4px 0 0" }}>الصور التي قمت بإرفاقها لتوثيق الحالة الجسمانية ومتابعة التطور البدني مع الكابتن</p>
          </div>
        </div>

        {bodyPhotos.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px", marginTop: "8px" }}>
            {bodyPhotos.map((url, idx) => (
              <a
                key={url}
                href={attachmentSrc(url) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="tpd-photo"
                style={{
                  display: "block",
                  position: "relative",
                  overflow: "hidden",
                  aspectRatio: "3 / 4",
                }}
              >
                <img
                  src={attachmentSrc(url) ?? undefined}
                  alt={`صورة التطور ${idx + 1}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div className="tpd-photo-caption" style={{
                  position: "absolute",
                  insetBlockEnd: 0,
                  insetInlineStart: 0,
                  insetInlineEnd: 0,
                  padding: "14px",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <span>صورة القياس {idx + 1}</span>
                  <Icon name="zoom_in" style={{ fontSize: "20px", color: "var(--primary)" }} />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="ui-empty" style={{ padding: "30px" }}>
            <Icon name="photo_camera" />
            <span>لم تقم بإرفاق صور لقياس التطور الجسدي عند بدء هذا الاشتراك.</span>
          </div>
        )}
      </section>
    </div>
  );
}
