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
  let bgColor = "var(--bg3)";
  let borderColor = "var(--border)";
  const textColor = "var(--text)";
  let labelColor = "var(--text-muted)";
  let iconColor = "var(--primary)";

  if (highlight) {
    bgColor = "color-mix(in srgb, var(--primary) 12%, var(--bg3))";
    borderColor = "color-mix(in srgb, var(--primary) 45%, var(--border))";
    labelColor = "var(--primary)";
    iconColor = "var(--primary)";
  } else if (alertColor === "red") {
    bgColor = "color-mix(in srgb, var(--error) 10%, var(--bg3))";
    borderColor = "color-mix(in srgb, var(--error) 45%, var(--border))";
    labelColor = "var(--error)";
    iconColor = "var(--error)";
  } else if (alertColor === "orange") {
    bgColor = "color-mix(in srgb, var(--warning) 12%, var(--bg3))";
    borderColor = "color-mix(in srgb, var(--warning) 45%, var(--border))";
    labelColor = "var(--warning)";
    iconColor = "var(--warning)";
  }

  return (
    <div
      style={{
        gridColumn: fullWidth ? "1 / -1" : "auto",
        background: bgColor,
        padding: "18px 20px",
        borderRadius: "var(--radius-xl)",
        border: `1px solid ${borderColor}`,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        position: "relative",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--primary)";
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 8px 24px color-mix(in srgb, var(--primary) 16%, rgba(0,0,0,0.35))";
        e.currentTarget.style.background = highlight ? "color-mix(in srgb, var(--primary) 16%, var(--bg3))" : "var(--bg4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
        e.currentTarget.style.background = bgColor;
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {icon && (
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: iconColor,
              }}
            >
              <Icon name={icon} style={{ fontSize: "18px" }} />
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
        <span style={{ background: "rgba(34, 197, 94, 0.15)", color: "var(--success-text)", padding: "4px 10px", borderRadius: "var(--radius-xl)", fontSize: "0.8rem", fontWeight: 700 }}>
          هدف نزول {Math.abs(diff).toFixed(1)} كغم
        </span>
      );
    } else if (diff > 0) {
      weightGoalBadge = (
        <span style={{ background: "color-mix(in srgb, var(--primary) 20%, transparent)", color: "var(--primary)", padding: "4px 10px", borderRadius: "var(--radius-xl)", fontSize: "0.8rem", fontWeight: 700 }}>
          هدف زيادة {diff.toFixed(1)} كغم
        </span>
      );
    } else {
      weightGoalBadge = (
        <span style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", padding: "4px 10px", borderRadius: "var(--radius-xl)", fontSize: "0.8rem", fontWeight: 700 }}>
          الحفاظ على الوزن المثالي
        </span>
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, animation: "fadeIn 0.4s ease" }}>
      {/* 1. Overview & Subscription Plan Summary */}
      <section
        className="dashboard-card"
        style={{
          padding: "32px",
          borderRadius: "var(--radius-xl)",
          background: "linear-gradient(145deg, var(--bg2), color-mix(in srgb, var(--primary) 5%, var(--bg2)))",
          border: "1px solid color-mix(in srgb, var(--primary) 35%, var(--border))",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px", borderBottom: "1px solid var(--border)", paddingBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "var(--radius-xl)", background: "color-mix(in srgb, var(--primary) 18%, var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", boxShadow: "0 4px 16px color-mix(in srgb, var(--primary) 25%, transparent)" }}>
            <Icon name="verified" style={{ fontSize: "32px" }} />
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
            style={{
              background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, var(--bg3)), var(--bg3))",
              padding: "20px",
              borderRadius: "var(--radius-xl)",
              border: "1px solid color-mix(in srgb, var(--primary) 50%, var(--border))",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "0 6px 22px color-mix(in srgb, var(--primary) 15%, transparent)",
              transition: "all 0.25s ease",
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
            value={answerLabel(data.sub_goal || data.goal || profile.goal, "غير محدد")}
            icon="emoji_events"
          />
        </div>
      </section>

      {/* 2. Basic Personal Information */}
      <section className="dashboard-card" style={{ padding: "28px", borderRadius: "var(--radius-xl)", background: "var(--bg2)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--primary) 15%, var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <Icon name="person_search" style={{ fontSize: "24px" }} />
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
          <MetricCard label="مستوى النشاط اليومي" value={activityLabel(data.activity || profile.activity, "—")} icon="monitoring" />
        </div>
      </section>

      {/* 3. Physical Metrics & Measurements */}
      <section className="dashboard-card" style={{ padding: "28px", borderRadius: "var(--radius-xl)", background: "var(--bg2)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--primary) 15%, var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <Icon name="activity" style={{ fontSize: "24px" }} />
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
      <section className="dashboard-card" style={{ padding: "28px", borderRadius: "var(--radius-xl)", background: "var(--bg2)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--primary) 15%, var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <Icon name="restaurant" style={{ fontSize: "24px" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>التغذية ونمط الحياة التفضيلية</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
          {/* Preferred Meal Times - Workdays */}
          <div style={{ gridColumn: "1 / -1", background: "var(--bg3)", padding: "22px", borderRadius: "var(--radius-xl)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
              <Icon name="schedule" style={{ color: "var(--primary)", fontSize: "24px" }} />
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>أوقات الوجبات المفضلة (أيام العمل والدوام)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
              <div style={{ background: "var(--bg2)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>الريوك (الفطور)</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.workday_breakfast, "—")}</span>
              </div>
              <div style={{ background: "var(--bg2)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>الغداء</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.workday_lunch, "—")}</span>
              </div>
              <div style={{ background: "var(--bg2)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>العشاء</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.workday_dinner, "—")}</span>
              </div>
            </div>
          </div>

          {/* Preferred Meal Times - Holidays */}
          <div style={{ gridColumn: "1 / -1", background: "var(--bg3)", padding: "22px", borderRadius: "var(--radius-xl)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
              <Icon name="event_available" style={{ color: "var(--primary)", fontSize: "24px" }} />
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>أوقات الوجبات المفضلة (أيام العطل والإجازات)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
              <div style={{ background: "var(--bg2)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>الريوك (الفطور)</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.holiday_breakfast, "—")}</span>
              </div>
              <div style={{ background: "var(--bg2)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>الغداء</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.holiday_lunch, "—")}</span>
              </div>
              <div style={{ background: "var(--bg2)", padding: "16px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px", alignItems: "center", textAlign: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>العشاء</span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{answerLabel(data.holiday_dinner, "—")}</span>
              </div>
            </div>
          </div>

          <MetricCard label="أنواع اللحوم المفضلة" value={answerList(data.meat, "—")} icon="restaurant_menu" />
          <MetricCard label="معدل استهلاك القهوة" value={`${answerLabel(data.coffee_rate, "—")}${data.coffee_type ? ` — (${data.coffee_type})` : ""}`} icon="bakery_dining" />
          <MetricCard label="شراء المكملات الغذائية" value={answerLabel(data.buy_supp, "—")} icon="medication" />
          <MetricCard label="الأكلات والوجبات المفضلة" value={data.fav_foods || "لم يتم ذكر أكلات معينة"} icon="restaurant" fullWidth />
          <MetricCard
            label="أطعمة مستبعدة أو حساسية غذائية"
            value={data.allergies || "لا توجد حساسية أو أطعمة مستبعدة"}
            icon="warning"
            alertColor={data.allergies ? "red" : undefined}
            fullWidth
          />
          <MetricCard label="المكملات الغذائية المستخدمة حالياً" value={data.supplements_list || "لا يوجد"} icon="medication" fullWidth />
          <MetricCard label="تاريخ الدايت والأنظمة الغذائية السابقة" value={data.diet_history || "لا يوجد"} icon="receipt_long" fullWidth />
        </div>
      </section>

      {/* 5. Training Background & Commitment */}
      <section className="dashboard-card" style={{ padding: "28px", borderRadius: "var(--radius-xl)", background: "var(--bg2)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--primary) 15%, var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <Icon name="fitness_center" style={{ fontSize: "24px" }} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>التمرين والالتزام الرياضي</h2>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          <MetricCard label="خبرة التمرين السابقة" value={answerLabel(data.workout_exp, "—")} icon="military_tech" />
          <MetricCard label="نوع الرياضة أو الخبرة" value={answerList(data.workout_type_exp, "—")} icon="exercise" />
          <MetricCard label="مكان الالتزام بالتمرين" value={answerLabel(data.workout_commit || data.place, "—")} icon="home" />
          <MetricCard label="الوقت المفضل لتأدية التمرين" value={answerLabel(data.gym_time, "—")} icon="schedule" />
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
      <section className="dashboard-card" style={{ padding: "28px", borderRadius: "var(--radius-xl)", background: "var(--bg2)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--primary) 15%, var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <Icon name="medical_services" style={{ fontSize: "24px" }} />
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
                  style={{
                    background: "var(--bg3)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    padding: "14px 22px",
                    borderRadius: "var(--radius-lg)",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    transition: "all 0.25s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "color-mix(in srgb, var(--primary) 20%, var(--bg3))";
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg3)";
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.transform = "translateY(0)";
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
          <div style={{ background: "var(--bg3)", padding: "30px", borderRadius: "var(--radius-xl)", border: "1px dashed var(--border)", textAlign: "center", color: "var(--text-muted)" }}>
            <Icon name="folder_off" style={{ fontSize: "36px", opacity: 0.6, marginBottom: "8px", display: "block", margin: "0 auto 8px" }} />
            <span>لم تقم بإرفاق ملفات تحاليل طبية أو تقارير أنظمة سابقة عند بدء الاشتراك.</span>
          </div>
        )}
      </section>

      {/* 7. Body Transformation Photos Gallery */}
      <section className="dashboard-card" style={{ padding: "28px", borderRadius: "var(--radius-xl)", background: "var(--bg2)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
          <div style={{ width: "46px", height: "46px", borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--primary) 15%, var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
            <Icon name="photo_library" style={{ fontSize: "24px" }} />
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
                style={{
                  display: "block",
                  position: "relative",
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  border: "2px solid var(--border)",
                  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.2)",
                  transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  aspectRatio: "3 / 4",
                  background: "var(--bg3)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                  e.currentTarget.style.boxShadow = "0 12px 28px color-mix(in srgb, var(--primary) 25%, rgba(0, 0, 0, 0.4))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.2)";
                }}
              >
                <img
                  src={attachmentSrc(url) ?? undefined}
                  alt={`صورة التطور ${idx + 1}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute",
                  insetBlockEnd: 0,
                  insetInlineStart: 0,
                  insetInlineEnd: 0,
                  padding: "14px",
                  background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)",
                  color: "#fff",
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
          <div style={{ background: "var(--bg3)", padding: "30px", borderRadius: "var(--radius-xl)", border: "1px dashed var(--border)", textAlign: "center", color: "var(--text-muted)" }}>
            <Icon name="photo_camera" style={{ fontSize: "38px", opacity: 0.6, marginBottom: "8px", display: "block", margin: "0 auto 8px" }} />
            <span>لم تقم بإرفاق صور لقياس التطور الجسدي عند بدء هذا الاشتراك.</span>
          </div>
        )}
      </section>
    </div>
  );
}
