// @ts-nocheck
"use client";

import React, { useState } from "react";
import type { UserProfile, MonthlyArchive } from "@/types";
import type { Day } from "@/types/admin";
import { Icon } from "@/components/Icon";
import {
  planLabel,
  activityLabel,
  answerLabel,
  answerList,
} from "@/lib/formLabels";
import toast from "react-hot-toast";
import {
  deleteMonthHistoryAction,
  deleteEntireHistoryAction,
  restoreHistoryAction,
} from "@/app/admin/profile/actions";

const getPlanColor = (plan: string | undefined | null) => {
  if (plan === 'plan1') return 'var(--plan-1)';
  if (plan === 'plan2') return 'var(--plan-2)';
  if (plan === 'plan3') return 'var(--plan-3)';
  return 'var(--primary)';
};
const getPlanTextColor = (plan: string | undefined | null) => {
  if (plan === 'plan1') return 'var(--plan-1-text)';
  if (plan === 'plan2') return 'var(--plan-2-text)';
  if (plan === 'plan3') return 'var(--plan-3-text)';
  return 'var(--text-inverse)';
};
const getPlanRgb = (plan: string | undefined | null) => {
  if (plan === 'plan1') return 'var(--plan-1-rgb)';
  if (plan === 'plan2') return 'var(--plan-2-rgb)';
  if (plan === 'plan3') return 'var(--plan-3-rgb)';
  return 'var(--primary-rgb)';
};

interface Props {
  profile: UserProfile;
  isAdminView?: boolean;
}

export function SubscriptionHistoryTimeline({
  profile,
  isAdminView = false,
}: Props) {
  const [selectedWorkoutMonth, setSelectedWorkoutMonth] = useState<
    number | null
  >(null);
  const [selectedDietMonth, setSelectedDietMonth] = useState<number | null>(
    null,
  );
  const [selectedInfoMonth, setSelectedInfoMonth] = useState<number | null>(
    null,
  );
  const [openMonths, setOpenMonths] = useState<Record<number, boolean>>({});

  const raw = (profile.raw_answers || {}) as Record<string, any>;
  const meas = (profile.measurements || raw.measurements || {}) as Record<
    string,
    any
  >;
  const isFemale = (profile.gender || raw.gender) === "female";
  const history: MonthlyArchive[] = profile.monthlyHistory || [];
  const totalMonths = history.length || 1;

  if (history.length === 0) {
    if (!isAdminView) return null;
    return (
      <section
        className="dashboard-card"
        style={{
          padding: "36px",
          borderRadius: "var(--radius-xl)",
          background: "var(--bg3)",
          border: "1px dashed var(--border)",
          textAlign: "center",
          direction: "rtl",
          fontFamily: "'Cairo', sans-serif",
          marginTop: "16px",
        }}
      >
        <div style={{ fontSize: "42px", marginBottom: "12px" }}>📭</div>
        <h3
          style={{
            fontSize: "1.4rem",
            fontWeight: 800,
            color: "var(--text)",
            marginBottom: "8px",
          }}
        >
          السجل التاريخي للاعب فارغ أو تم حذفه
        </h3>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "1rem",
            maxWidth: "550px",
            margin: "0 auto 24px auto",
            lineHeight: "1.7",
          }}
        >
          تم تفريغ أو حذف السجل التاريخي بالكامل من قبل المدرب، أو لا توجد
          اشتراكات سابقة مسجلة لهذا اللاعب. تتيح لك الصلاحيات إمكانية الإبقاء
          على البيانات أو استعادتها في أي وقت.
        </p>
        {((raw.deleted_months && (raw.deleted_months as number[]).length > 0) ||
          raw.delete_all_history) && (
          <button
            type="button"
            onClick={async () => {
              if (
                window.confirm(
                  "هل أنت متأكد من استعادة السجل التاريخي والإبقاء على البيانات؟",
                )
              ) {
                const res = await restoreHistoryAction(profile.id);
                if (res.success) {
                  toast.success("تم استعادة السجل التاريخي بنجاح!");
                } else {
                  toast.error(res.error || "فشل الاستعادة");
                }
              }
            }}
            style={{
              padding: "10px 24px",
              borderRadius: "var(--radius-lg)",
              background: "var(--primary)",
              color: "var(--text-inverse)",
              border: "none",
              fontWeight: 800,
              fontSize: "1rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Icon name="restore" style={{ fontSize: "22px" }} />
            <span>استعادة السجل التاريخي (الإبقاء دون حذف)</span>
          </button>
        )}
      </section>
    );
  }

  const firstMonth = history[0];

  return (
    <section
      className="dashboard-card"
      style={{
        padding: "32px",
        borderRadius: "var(--radius-xl)",
        background:
          "linear-gradient(145deg, var(--bg2), color-mix(in srgb, var(--primary) 5%, var(--bg2)))",
        border:
          "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))",
        boxShadow: "var(--elev-2)",
        direction: "rtl",
        fontFamily: "'Cairo', sans-serif",
        marginTop: "32px",
        marginBottom: "24px",
      }}
    >
      {/* Header & Overview Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "24px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flex: "1 1 300px",
          }}
        >
          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "var(--radius-xl)",
              background: "color-mix(in srgb, var(--primary) 18%, var(--bg3))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-on-tint)",
              boxShadow:
                "0 6px 20px color-mix(in srgb, var(--primary) 25%, transparent)",
              flexShrink: 0,
            }}
          >
            <Icon name="view_timeline" style={{ fontSize: "34px" }} />
          </div>
          <div>
            <h2
              style={{
                fontSize: "1.65rem",
                fontWeight: 800,
                color: "var(--text)",
                margin: "0 0 6px 0",
                letterSpacing: "-0.3px",
              }}
            >
              سجل الاشتراك التاريخي والأنظمة السابقة
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
                lineHeight: "1.6",
              }}
            >
              {isAdminView
                ? "أرشيف رحلة المتدرب الرياضية والغذائية مقسمة حسب أشهر الاشتراك التراكمية. يمكنك كمدرب مراجعة أو تحميل جداول الأشهر السابقة الخاصة بالمتدرب بكل سرعة وسلاسة."
                : "أرشيف رحلتك البدنية والتغذوية مع الكابتن إبراهيم. يمكنك مراجعة واستعراض أو تحميل أي نظام تدريبي أو غذائي من كافة أشهر اشتراكك التراكمية."}
            </p>
          </div>
        </div>

        {/* Duration counter pills */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              padding: "10px 18px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg3)",
              border:
                "1px solid color-mix(in srgb, var(--primary) 40%, transparent)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "var(--elev-1)",
            }}
          >
            <Icon
              name="calendar_month"
              style={{ color: "var(--primary-on-tint)", fontSize: "22px" }}
            />
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                إجمالي مدة الاشتراك
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  color: "var(--primary-on-tint)",
                  fontWeight: 800,
                }}
              >
                {totalMonths} أشهر
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 18px",
              borderRadius: "var(--radius-lg)",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Icon
              name="card_membership"
              style={{ color: "var(--success-text)", fontSize: "22px" }}
            />
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                }}
              >
                تاريخ بدء الرحلة
              </div>
              <div
                style={{
                  fontSize: "1rem",
                  color: "var(--text)",
                  fontWeight: 700,
                }}
              >
                {firstMonth?.startDate || "مسجل"}
              </div>
            </div>
          </div>

          <a
            href={`/export-profile?profileId=${profile.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "11px 20px",
              borderRadius: "var(--radius-lg)",
              background: "var(--primary)",
              color: "var(--text-inverse)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontWeight: 800,
              fontSize: "0.95rem",
              boxShadow: "var(--elev-1)",
              transition:
                "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
            }}
            title="تحميل التقرير الشامل للأرشيف وكافة معلومات وقياسات المتدرب"
          >
            <Icon name="file_download" style={{ fontSize: "22px" }} />
            <span>تحميل التقرير الشامل PDF</span>
          </a>
        </div>
      </div>

      {isAdminView && (
        <div
          style={{
            padding: "20px 24px",
            borderRadius: "var(--radius-xl)",
            background: "var(--bg3)",
            border: "1px solid var(--border)",
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>🛡️</span>
            <div>
              <div
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  color: "var(--text)",
                }}
              >
                إدارة التحكم بالسجل التاريخي للمدرب
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  marginTop: "4px",
                }}
              >
                تمنحك هذه الصلاحية التحكم الكامل بحذف السجل بالكامل، أو جزء منه،
                أو الإبقاء عليه دون حذف.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={async () => {
                if (
                  window.confirm(
                    "هل أنت متأكد من مسح وحذف السجل التاريخي والأنظمة السابقة بالكامل لهذا المتدرب؟",
                  )
                ) {
                  const res = await deleteEntireHistoryAction(profile.id);
                  if (res.success) {
                    toast.success("تم حذف السجل بالكامل بنجاح!");
                  } else {
                    toast.error(res.error || "فشل مسح السجل");
                  }
                }
              }}
              style={{
                padding: "8px 18px",
                borderRadius: "var(--radius-lg)",
                background: "color-mix(in srgb, var(--error) 20%, transparent)",
                color: "var(--error-text)",
                border:
                  "1px solid color-mix(in srgb, var(--error) 50%, transparent)",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition:
                  "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
              }}
            >
              <Icon name="delete_forever" style={{ fontSize: "20px" }} />
              <span>حذف السجل بالكامل</span>
            </button>

            {((raw.deleted_months &&
              (raw.deleted_months as number[]).length > 0) ||
              raw.delete_all_history) && (
              <button
                type="button"
                onClick={async () => {
                  if (
                    window.confirm(
                      "هل تريد استعادة السجل التاريخي المحذوف والإبقاء عليه دون حذف؟",
                    )
                  ) {
                    const res = await restoreHistoryAction(profile.id);
                    if (res.success) {
                      toast.success(
                        "تم استعادة السجل التاريخي والإبقاء عليه بنجاح!",
                      );
                    } else {
                      toast.error(res.error || "فشل استعادة السجل");
                    }
                  }
                }}
                style={{
                  padding: "8px 18px",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--primary)",
                  color: "var(--text-inverse)",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  transition:
                    "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
                }}
              >
                <Icon name="restore" style={{ fontSize: "20px" }} />
                <span>استعادة السجل المحذوف (الإبقاء دون حذف)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Months Timeline Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {history.map((item) => {
          const isWorkoutOpen = selectedWorkoutMonth === item.monthNumber;
          const isDietOpen = selectedDietMonth === item.monthNumber;
          const isInfoOpen = selectedInfoMonth === item.monthNumber;
          const isCurrentMonth = item.status === "current";
          const isMonthOpen =
            openMonths[item.monthNumber] !== undefined
              ? openMonths[item.monthNumber]
              : isCurrentMonth;

          return (
            <div
              key={item.monthNumber}
              style={{
                borderRadius: "var(--radius-xl)",
                background: "var(--bg2)",
                border: isCurrentMonth
                  ? "2px solid var(--primary)"
                  : "1px solid var(--border)",
                boxShadow: isCurrentMonth
                  ? "0 0 25px color-mix(in srgb, var(--primary) 15%, transparent)"
                  : "var(--elev-2)",
                transition:
                  "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
                overflow: "hidden",
              }}
            >
              {/* Month Header Bar - Clickable Accordion Header */}
              <div
                onClick={() => {
                  setOpenMonths((prev) => ({
                    ...prev,
                    [item.monthNumber]:
                      prev[item.monthNumber] !== undefined
                        ? !prev[item.monthNumber]
                        : !isCurrentMonth,
                  }));
                }}
                style={{
                  background: isCurrentMonth
                    ? "linear-gradient(90deg, color-mix(in srgb, var(--primary) 20%, var(--bg3)), var(--bg3))"
                    : "var(--bg3)",
                  padding: "18px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  flexWrap: "wrap",
                  borderBottom: isMonthOpen
                    ? "1px solid var(--border)"
                    : "none",
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "background 0.2s ease",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <span
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "var(--radius-circle)",
                      background: isCurrentMonth
                        ? "var(--primary)"
                        : "var(--bg4)",
                      color: isCurrentMonth
                        ? "var(--text-inverse)"
                        : "var(--text)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "1.05rem",
                      border: isCurrentMonth
                        ? "none"
                        : "1px solid var(--border)",
                    }}
                  >
                    {item.monthNumber}
                  </span>
                  <div>
                    <h3
                      style={{
                        fontSize: "1.3rem",
                        fontWeight: 800,
                        color: "var(--text)",
                        margin: 0,
                      }}
                    >
                      {item.monthName}
                    </h3>
                    <span
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--text-secondary)",
                        display: "block",
                      }}
                    >
                      من {item.startDate} إلى {item.endDate}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  {isAdminView && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (
                          window.confirm(
                            `هل أنت متأكد من حذف ( ${item.monthName} ) من السجل التاريخي للاعب؟`,
                          )
                        ) {
                          const res = await deleteMonthHistoryAction(
                            profile.id,
                            item.monthNumber,
                          );
                          if (res.success) {
                            toast.success(
                              `تم حذف ${item.monthName} من السجل بنجاح!`,
                            );
                          } else {
                            toast.error(res.error || "فشل الحذف");
                          }
                        }
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "var(--radius-pill)",
                        background:
                          "color-mix(in srgb, var(--error) 15%, transparent)",
                        color: "var(--error-text)",
                        border:
                          "1px solid color-mix(in srgb, var(--error) 40%, transparent)",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition:
                          "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
                      }}
                      title="حذف بيانات هذا الشهر من السجل التاريخي"
                    >
                      <Icon name="delete" style={{ fontSize: "16px" }} />
                      <span>حذف هذا الشهر من السجل</span>
                    </button>
                  )}
                  {isCurrentMonth ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background:
                          "color-mix(in srgb, var(--primary) 20%, transparent)",
                        color: "var(--primary-on-tint)",
                        border:
                          "1px solid color-mix(in srgb, var(--primary) 50%, transparent)",
                        padding: "6px 14px",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        boxShadow:
                          "0 0 10px color-mix(in srgb, var(--primary) 25%, transparent)",
                      }}
                    >
                      <Icon name="emoji_events" style={{ fontSize: "16px" }} />
                      الشهر الحالي (نشط)
                    </span>
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background:
                          "color-mix(in srgb, var(--success) 15%, transparent)",
                        color: "var(--success-text)",
                        border:
                          "1px solid color-mix(in srgb, var(--success) 40%, transparent)",
                        padding: "6px 14px",
                        borderRadius: "var(--radius-pill)",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                      }}
                    >
                      <Icon name="check_circle" style={{ fontSize: "16px" }} />
                      دورة مكتملة ومؤرشفة
                    </span>
                  )}
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "var(--radius-circle)",
                      background: "var(--bg4)",
                      border: "1px solid var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isMonthOpen ? "var(--primary)" : "var(--muted)",
                      transition: "transform 0.3s ease, color 0.3s ease",
                      transform: isMonthOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    }}
                    title={isMonthOpen ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                  >
                    <Icon name="expand_more" style={{ fontSize: "24px" }} />
                  </div>
                </div>
              </div>

              {/* Accordion Body - Shown only when isMonthOpen is true */}
              {isMonthOpen && (
                <div>
                  {/* Workout & Diet Cards inside Month */}
                  <div
                    style={{
                      padding: "24px",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "20px",
                    }}
                  >
                    {/* Workout Plan Box */}
                    <div
                      className="timeline-card"
                      style={{
                        padding: "22px",
                        borderRadius: "var(--radius-xl)",
                        background: "var(--bg3)",
                        border: isWorkoutOpen
                          ? "1px solid var(--primary)"
                          : "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "18px",
                        boxShadow: "var(--elev-1)",
                        "--t-color-idle": "var(--primary)",
                      } as React.CSSProperties}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            marginBottom: "14px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <Icon
                              name="fitness_center"
                              style={{
                                fontSize: "24px",
                                color: "var(--primary-on-tint)",
                              }}
                            />
                            <span
                              style={{
                                fontWeight: 800,
                                color: "var(--text)",
                                fontSize: "1.15rem",
                              }}
                            >
                              النظام التدريبي للشهر
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              padding: "4px 12px",
                              borderRadius: "var(--radius-md)",
                              background:
                                "color-mix(in srgb, var(--primary) 15%, var(--bg2))",
                              color: "var(--primary-on-tint)",
                              fontWeight: 700,
                              border:
                                "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                            }}
                          >
                            {item.workout?.daysCount
                              ? `${item.workout.daysCount} أيام بالدورة`
                              : "جدول تمارين مجدول"}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "1rem",
                            color: "var(--text)",
                            fontWeight: 700,
                          }}
                        >
                          {item.workout?.courseName ||
                            "جدول التمارين المخصص من الكابتن إبراهيم"}
                        </p>
                        <p
                          style={{
                            margin: "8px 0 0",
                            fontSize: "0.88rem",
                            color: "var(--text-secondary)",
                            lineHeight: "1.6",
                          }}
                        >
                          يحتوي على تفاصيل التمارين، الجلسات، التكرارات
                          والملاحظات التدريبية المعتمدة لهذا الشهر.
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "stretch",
                          marginTop: "auto",
                          flexWrap: "nowrap",
                        }}
                      >
                        <button
                          onClick={() => {
                            setSelectedWorkoutMonth(
                              isWorkoutOpen ? null : item.monthNumber,
                            );
                            if (!isWorkoutOpen) setSelectedDietMonth(null);
                          }}
                          className="timeline-card-btn"
                          style={{
                            flex: 1,
                            height: "46px",
                            padding: "0 16px",
                            borderRadius: "var(--radius-lg)",
                            background: "color-mix(in srgb, var(--primary) 12%, var(--bg2))",
                            color: "var(--primary-on-tint)",
                            border: "1px solid color-mix(in srgb, var(--primary) 40%, transparent)",
                            fontWeight: 800,
                            fontSize: "0.94rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            whiteSpace: "nowrap",
                            transition:
                              "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur-fast) var(--ease)",
                            "--t-color-idle": "var(--primary)",
                          } as React.CSSProperties}
                          title={isWorkoutOpen ? "إخفاء التمارين" : "استعراض التمارين"}
                        >
                          <Icon
                            name={isWorkoutOpen ? "close" : "fitness_center"}
                            style={{ fontSize: "24px" }}
                          />
                        </button>
                        <a
                          href={
                            item.workout?.courseId
                              ? `/export-workout?courseId=${item.workout.courseId}`
                              : `/export-profile?profileId=${profile.id}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: "0 0 auto",
                            minWidth: "95px",
                            height: "46px",
                            padding: "0 16px",
                            borderRadius: "var(--radius-lg)",
                            background: "var(--bg4)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            transition:
                              "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
                          }}
                          title="تحميل جدول التمارين PDF"
                        >
                          <Icon
                            name="file_download"
                            style={{
                              fontSize: "20px",
                              color: "var(--primary-on-tint)",
                            }}
                          />
                        </a>
                      </div>
                    </div>

                    {/* Diet Plan Box */}
                    <div
                      className="timeline-card"
                      style={{
                        padding: "22px",
                        borderRadius: "var(--radius-xl)",
                        background: "var(--bg3)",
                        border: isDietOpen
                          ? "1px solid var(--success)"
                          : "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "18px",
                        boxShadow: "var(--elev-1)",
                        "--t-color-idle": "var(--success-text)",
                      } as React.CSSProperties}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            marginBottom: "14px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <Icon
                              name="restaurant"
                              style={{
                                fontSize: "24px",
                                color: "var(--success-text)",
                              }}
                            />
                            <span
                              style={{
                                fontWeight: 800,
                                color: "var(--text)",
                                fontSize: "1.15rem",
                              }}
                            >
                              النظام الغذائي للشهر
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              padding: "4px 12px",
                              borderRadius: "var(--radius-md)",
                              background:
                                "color-mix(in srgb, var(--success) 15%, var(--bg2))",
                              color: "var(--success-text)",
                              fontWeight: 700,
                              border:
                                "1px solid color-mix(in srgb, var(--success) 35%, transparent)",
                            }}
                          >
                            {item.diet?.calories
                              ? `${item.diet.calories} سعرة حرارية`
                              : "نظام غذائي مخصص"}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "1rem",
                            color: "var(--text)",
                            fontWeight: 700,
                          }}
                        >
                          {item.diet?.name === "النظام الأول"
                            ? "نظامين للتغذية"
                            : item.diet?.name || "نظامين للتغذية"}
                        </p>
                        <p
                          style={{
                            margin: "8px 0 0",
                            fontSize: "0.88rem",
                            color: "var(--text-secondary)",
                            lineHeight: "1.6",
                          }}
                        >
                          يحتوي على تقسيم الوجبات اليومية والاحتياج التغذوي الكامل.
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "stretch",
                          marginTop: "auto",
                          flexWrap: "nowrap",
                        }}
                      >
                        <button
                          onClick={() => {
                            setSelectedDietMonth(
                              isDietOpen ? null : item.monthNumber,
                            );
                            if (!isDietOpen) setSelectedWorkoutMonth(null);
                          }}
                          className="timeline-card-btn"
                          style={{
                            flex: 1,
                            height: "46px",
                            padding: "0 16px",
                            borderRadius: "var(--radius-lg)",
                            background: "color-mix(in srgb, var(--success) 12%, var(--bg2))",
                            color: "var(--success-text)",
                            border: "1px solid color-mix(in srgb, var(--success) 40%, transparent)",
                            fontWeight: 800,
                            fontSize: "0.94rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            whiteSpace: "nowrap",
                            transition:
                              "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur-fast) var(--ease)",
                            "--t-color-idle": "var(--success-text)",
                          } as React.CSSProperties}
                          title={isDietOpen ? "إخفاء النظام الغذائي" : "استعراض النظام الغذائي"}
                        >
                          <Icon
                            name={isDietOpen ? "close" : "restaurant"}
                            style={{ fontSize: "24px" }}
                          />
                        </button>
                        <a
                          href={`/export-diet?profileId=${profile.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            flex: "0 0 auto",
                            minWidth: "95px",
                            height: "46px",
                            padding: "0 16px",
                            borderRadius: "var(--radius-lg)",
                            background: "var(--bg4)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            transition:
                              "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
                          }}
                          title="تحميل التغذية كجدول PDF"
                        >
                          <Icon
                            name="file_download"
                            style={{
                              fontSize: "20px",
                              color: "var(--success-text)",
                            }}
                          />
                        </a>
                      </div>
                    </div>

                    {/* Comprehensive Data & Measurements Box */}
                    <div
                      className="timeline-card"
                      style={{
                        padding: "22px",
                        borderRadius: "var(--radius-xl)",
                        background: "var(--bg3)",
                        border: isInfoOpen
                          ? `1px solid var(--error-text)`
                          : "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "18px",
                        boxShadow: "var(--elev-1)",
                        "--t-color-idle": "var(--error-text)",
                      } as React.CSSProperties}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            marginBottom: "14px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <Icon
                              name="description"
                              style={{ fontSize: "24px", color: "var(--error-text)" }}
                            />
                            <span
                              style={{
                                fontWeight: 800,
                                color: "var(--text)",
                                fontSize: "1.15rem",
                              }}
                            >
                              البيانات الشاملة والقياسات
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.8rem",
                              padding: "4px 12px",
                              borderRadius: "var(--radius-md)",
                              background: "color-mix(in srgb, var(--error) 15%, var(--bg2))",
                              color: "var(--error-text)",
                              fontWeight: 700,
                              border: "1px solid color-mix(in srgb, var(--error) 35%, transparent)",
                            }}
                          >
                            ملف متكامل
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "1rem",
                            color: "var(--text)",
                            fontWeight: 700,
                          }}
                        >
                          المعلومات الهيكلية، القياسات الجسدية والاستبيان
                        </p>
                        <p
                          style={{
                            margin: "8px 0 0",
                            fontSize: "0.88rem",
                            color: "var(--text-secondary)",
                            lineHeight: "1.6",
                          }}
                        >
                          يحتوي على كافة قياسات الجسم، الوزن، الطول، الأهداف
                          الرياضية، والبيانات الصحية ونمط الحياة المعتمد.
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "stretch",
                          marginTop: "auto",
                          flexWrap: "nowrap",
                        }}
                      >
                        <button
                          onClick={() => {
                            setSelectedInfoMonth(
                              isInfoOpen ? null : item.monthNumber,
                            );
                            if (!isInfoOpen) {
                              setSelectedWorkoutMonth(null);
                              setSelectedDietMonth(null);
                            }
                          }}
                          className="timeline-card-btn"
                          style={{
                            flex: 1,
                            height: "46px",
                            padding: "0 16px",
                            borderRadius: "var(--radius-lg)",
                            background: "color-mix(in srgb, var(--error) 12%, var(--bg2))",
                            color: "var(--error-text)",
                            border: "1px solid color-mix(in srgb, var(--error) 40%, transparent)",
                            fontWeight: 800,
                            fontSize: "0.94rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            whiteSpace: "nowrap",
                            transition:
                              "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur-fast) var(--ease)",
                            "--t-color-idle": "var(--error-text)",
                          } as React.CSSProperties}
                          title={isInfoOpen ? "إخفاء البيانات" : "استعراض البيانات"}
                        >
                          <Icon
                            name={isInfoOpen ? "close" : "description"}
                            style={{ fontSize: "24px" }}
                          />
                        </button>
                        <a
                          href={`/export-profile?profileId=${profile.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            minWidth: "95px",
                            padding: "11px 16px",
                            borderRadius: "var(--radius-lg)",
                            background: "var(--bg4)",
                            color: "var(--text)",
                            border: "1px solid var(--border)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            fontSize: "0.9rem",
                            fontWeight: 800,
                            transition:
                              "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease)",
                          }}
                          title="تحميل كجدول PDF"
                        >
                          <Icon
                            name="file_download"
                            style={{ fontSize: "20px", color: "var(--error-text)" }}
                          />
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Workout Schedule Details */}
                  {isWorkoutOpen && (
                    <div
                      style={{
                        background: "var(--bg1)",
                        borderTop: "1px solid var(--border)",
                        padding: "24px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "20px",
                        }}
                      >
                        <h4
                          style={{
                            fontSize: "1.2rem",
                            fontWeight: 800,
                            color: "var(--primary-on-tint)",
                            margin: 0,
                          }}
                        >
                          💪 تفاصيل التمارين التدريبية ({item.monthName})
                        </h4>
                        <button
                          onClick={() => setSelectedWorkoutMonth(null)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "1.6rem",
                          }}
                          title="إغلاق"
                        >
                          &times;
                        </button>
                      </div>

                      {!item.workout?.daysData ||
                      item.workout.daysData.length === 0 ? (
                        <p
                          style={{
                            color: "var(--text-secondary)",
                            textAlign: "center",
                            padding: "24px 0",
                            fontSize: "1rem",
                          }}
                        >
                          لا يوجد تمارين مدرجة لهذا الشهر أو قيد التجهيز من قبل
                          الكابتن إبراهيم.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "28px",
                          }}
                        >
                          {item.workout.daysData.map((day, dIdx) => (
                            <div
                              key={dIdx}
                              style={{
                                padding: "26px",
                                borderRadius: "var(--radius-xl)",
                                background: "var(--bg2)",
                                border:
                                  "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))",
                                boxShadow: "var(--elev-1)",
                                position: "relative",
                                overflow: "hidden",
                              }}
                            >
                              {/* Top Accent */}
                              <div
                                style={{
                                  position: "absolute",
                                  insetBlockStart: 0,
                                  insetInline: 0,
                                  height: "3px",
                                  background:
                                    "linear-gradient(90deg, var(--primary), transparent)",
                                }}
                              />

                              {/* Day Header Bar */}
                              <div
                                style={{
                                  background:
                                    "color-mix(in srgb, var(--bg3) 80%, transparent)",
                                  padding: "16px 22px",
                                  borderRadius: "var(--radius-xl)",
                                  border: "1px solid var(--border)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  flexWrap: "wrap",
                                  gap: "14px",
                                  marginBottom: "24px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "14px",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "48px",
                                      height: "48px",
                                      borderRadius: "var(--radius-lg)",
                                      background: "var(--primary)",
                                      color: "var(--text-inverse)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "26px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Icon name="fitness_center" />
                                  </div>
                                  <div>
                                    <span
                                      style={{
                                        fontSize: "0.8rem",
                                        color: "var(--primary-on-tint)",
                                        fontWeight: 700,
                                        letterSpacing: "0.5px",
                                        textTransform: "uppercase",
                                        display: "block",
                                        marginBottom: "3px",
                                      }}
                                    >
                                      جدول التمارين والمقاومة
                                    </span>
                                    <h5
                                      style={{
                                        margin: 0,
                                        fontWeight: 900,
                                        color: "var(--text)",
                                        fontSize: "1.35rem",
                                        letterSpacing: "-0.3px",
                                      }}
                                    >
                                      اليوم {dIdx + 1}:{" "}
                                      {day.name ||
                                        day.title ||
                                        (day.muscles && day.muscles.length > 0
                                          ? day.muscles.join(" / ")
                                          : `تمرين ${dIdx + 1}`)}
                                    </h5>
                                  </div>
                                </div>
                                <span
                                  style={{
                                    fontSize: "0.95rem",
                                    color: "var(--text-inverse)",
                                    fontWeight: 900,
                                    background: "var(--primary)",
                                    padding: "8px 20px",
                                    borderRadius: "var(--radius-pill)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <Icon
                                    name="bolt"
                                    style={{
                                      fontSize: "18px",
                                      color: "var(--text-inverse)",
                                    }}
                                  />
                                  <span>
                                    {day.exercises?.length ?? 0} تمارين
                                  </span>
                                </span>
                              </div>

                              {!day.exercises || day.exercises.length === 0 ? (
                                <div
                                  style={{
                                    padding: "30px",
                                    textAlign: "center",
                                    background:
                                      "color-mix(in srgb, var(--bg3) 50%, transparent)",
                                    borderRadius: "var(--radius-xl)",
                                    border: "1px dashed var(--border)",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "36px",
                                      marginBottom: "8px",
                                    }}
                                  >
                                    🧘
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "1.1rem",
                                      color: "var(--text-secondary)",
                                      fontWeight: 700,
                                    }}
                                  >
                                    يوم راحة مخصص / لا توجد تمارين مسجلة لهذا
                                    اليوم
                                  </span>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns:
                                      "repeat(auto-fill, minmax(300px, 1fr))",
                                    gap: "20px",
                                  }}
                                >
                                  {day.exercises.map((ex, exIdx) => {
                                    const videoUrl = (ex as any).video_url;
                                    const restVal =
                                      (ex as any).rest_time ||
                                      (ex as any).rest ||
                                      ((ex as any).rest_from
                                        ? `${(ex as any).rest_from} - ${(ex as any).rest_to} ${(ex as any).rest_to_unit || "sec"}`
                                        : "60 - 90 sec");

                                    return (
                                      <div
                                        key={exIdx}
                                        style={{
                                          padding: "22px",
                                          borderRadius: "var(--radius-xl)",
                                          background: "var(--bg3)",
                                          border:
                                            "1px solid color-mix(in srgb, var(--primary) 35%, var(--border))",
                                          display: "flex",
                                          flexDirection: "column",
                                          justifyContent: "space-between",
                                          gap: "18px",
                                          boxShadow: "var(--elev-1)",
                                        }}
                                      >
                                        {/* Top Header of Exercise Card */}
                                        <div
                                          style={{
                                            display: "flex",
                                            alignItems: "flex-start",
                                            justifyContent: "space-between",
                                            gap: "12px",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              alignItems: "flex-start",
                                              gap: "12px",
                                              flex: 1,
                                            }}
                                          >
                                            <span
                                              style={{
                                                width: "32px",
                                                height: "32px",
                                                borderRadius:
                                                  "var(--radius-md)",
                                                background: "var(--primary)",
                                                color: "var(--text-inverse)",
                                                fontWeight: 900,
                                                fontSize: "0.95rem",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                              }}
                                            >
                                              {exIdx + 1}
                                            </span>
                                            <span
                                              style={{
                                                fontWeight: 800,
                                                fontSize: "1.15rem",
                                                color: "var(--text)",
                                                lineHeight: "1.4",
                                              }}
                                            >
                                              {ex.name ||
                                                ex.name_ar ||
                                                "تمرين مقترح"}
                                            </span>
                                          </div>
                                          {videoUrl && (
                                            <a
                                              href={videoUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              style={{
                                                background:
                                                  "var(--primary-dim)",
                                                color: "var(--primary-on-tint)",
                                                border:
                                                  "1px solid var(--border-primary)",
                                                padding: "4px 10px",
                                                borderRadius:
                                                  "var(--radius-sm)",
                                                fontSize: "0.78rem",
                                                fontWeight: 800,
                                                textDecoration: "none",
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                flexShrink: 0,
                                              }}
                                              title="مشاهدة فيديو التمرين"
                                            >
                                              <span>🎬 فيديو</span>
                                            </a>
                                          )}
                                        </div>

                                        {/* Advanced 3-Column Stats Instrument Panel */}
                                        <div
                                          style={{
                                            background: "var(--bg2)",
                                            border: "1px solid var(--border)",
                                            borderRadius: "var(--radius-xl)",
                                            padding: "14px 12px",
                                            display: "grid",
                                            gridTemplateColumns:
                                              "1fr auto 1fr auto 1.1fr",
                                            alignItems: "center",
                                            gap: "6px",
                                          }}
                                        >
                                          {/* Sets */}
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              alignItems: "center",
                                              textAlign: "center",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                marginBottom: "4px",
                                              }}
                                            >
                                              <Icon
                                                name="layers"
                                                style={{
                                                  fontSize: "15px",
                                                  color:
                                                    "var(--primary-on-tint)",
                                                }}
                                              />
                                              <span
                                                style={{
                                                  fontSize: "0.76rem",
                                                  color:
                                                    "var(--text-secondary)",
                                                  fontWeight: 700,
                                                }}
                                              >
                                                الجلسات
                                              </span>
                                            </div>
                                            <span
                                              style={{
                                                fontSize: "1.2rem",
                                                fontWeight: 900,
                                                color: "var(--primary-on-tint)",
                                              }}
                                            >
                                              {ex.sets ?? 3}
                                            </span>
                                          </div>

                                          {/* Vertical Divider */}
                                          <div
                                            style={{
                                              width: "1px",
                                              height: "34px",
                                              background: "var(--border)",
                                            }}
                                          />

                                          {/* Reps */}
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              alignItems: "center",
                                              textAlign: "center",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                marginBottom: "4px",
                                              }}
                                            >
                                              <Icon
                                                name="repeat"
                                                style={{
                                                  fontSize: "15px",
                                                  color: "var(--warning-text)",
                                                }}
                                              />
                                              <span
                                                style={{
                                                  fontSize: "0.76rem",
                                                  color:
                                                    "var(--text-secondary)",
                                                  fontWeight: 700,
                                                }}
                                              >
                                                التكرارات
                                              </span>
                                            </div>
                                            <span
                                              style={{
                                                fontSize: "1.1rem",
                                                fontWeight: 900,
                                                color: "var(--warning-text)",
                                                direction: "ltr",
                                              }}
                                            >
                                              {Array.isArray(ex.reps)
                                                ? ex.reps.join(" - ")
                                                : (ex.reps ?? "10")}
                                            </span>
                                          </div>

                                          {/* Vertical Divider */}
                                          <div
                                            style={{
                                              width: "1px",
                                              height: "34px",
                                              background: "var(--border)",
                                            }}
                                          />

                                          {/* Rest */}
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              alignItems: "center",
                                              textAlign: "center",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                marginBottom: "4px",
                                              }}
                                            >
                                              <Icon
                                                name="timer"
                                                style={{
                                                  fontSize: "15px",
                                                  color: "var(--success-text)",
                                                }}
                                              />
                                              <span
                                                style={{
                                                  fontSize: "0.76rem",
                                                  color:
                                                    "var(--text-secondary)",
                                                  fontWeight: 700,
                                                }}
                                              >
                                                الراحة
                                              </span>
                                            </div>
                                            <span
                                              style={{
                                                fontSize: "1.05rem",
                                                fontWeight: 900,
                                                color: "var(--success-text)",
                                                direction: "ltr",
                                              }}
                                            >
                                              {restVal}
                                            </span>
                                          </div>
                                        </div>

                                        {ex.notes && (
                                          <div
                                            style={{
                                              background:
                                                "color-mix(in srgb, var(--primary) 12%, var(--bg2))",
                                              border:
                                                "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                                              borderRadius: "var(--radius-lg)",
                                              padding: "10px 14px",
                                              fontSize: "0.88rem",
                                              color: "var(--primary-on-tint)",
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "8px",
                                              fontWeight: 700,
                                            }}
                                          >
                                            <span style={{ fontSize: "16px" }}>
                                              💡
                                            </span>
                                            <span>{ex.notes}</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Diet Schedule Details */}
                  {isDietOpen && (
                    <div
                      style={{
                        background: "var(--bg1)",
                        borderTop: "1px solid var(--border)",
                        padding: "24px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "20px",
                        }}
                      >
                        <h4
                          style={{
                            fontSize: "1.2rem",
                            fontWeight: 800,
                            color: "var(--primary-on-tint)",
                            margin: 0,
                          }}
                        >
                          🥗 تفاصيل النظام الغذائي ({item.monthName})
                        </h4>
                        <button
                          onClick={() => setSelectedDietMonth(null)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "1.6rem",
                          }}
                          title="إغلاق"
                        >
                          &times;
                        </button>
                      </div>

                      {!item.diet?.mealsData ||
                      item.diet.mealsData.length === 0 ? (
                        <p
                          style={{
                            color: "var(--text-secondary)",
                            textAlign: "center",
                            padding: "24px 0",
                            fontSize: "1rem",
                          }}
                        >
                          لا يوجد جدول غذائي متاح أو قيد التجهيز من قبل الكابتن
                          إبراهيم.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "24px",
                          }}
                        >
                          {item.diet.mealsData.map((planItem, pIdx) => (
                            <div
                              key={pIdx}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                              }}
                            >
                              <h5
                                style={{
                                  margin: 0,
                                  fontSize: "1.1rem",
                                  color: "var(--text)",
                                  borderRight: "4px solid var(--primary)",
                                  paddingRight: "12px",
                                  fontWeight: 800,
                                }}
                              >
                                {planItem.name || `خطة رقم ${pIdx + 1}`}
                              </h5>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(280px, 1fr))",
                                  gap: "14px",
                                }}
                              >
                                {planItem.meals &&
                                  Object.entries(planItem.meals).map(
                                    ([slotKey, slotData], sIdx) => {
                                      if (
                                        !slotData ||
                                        (!slotData.time &&
                                          (!slotData.items ||
                                            slotData.items.length === 0))
                                      )
                                        return null;
                                      const mealTitles: Record<string, string> =
                                        {
                                          breakfast: "وجبة الإفطار",
                                          lunch: "وجبة الغداء",
                                          dinner: "وجبة العشاء",
                                          snack1: "وجبة خفيفة (سناك 1)",
                                          snack2: "وجبة خفيفة (سناك 2)",
                                        };
                                      return (
                                        <div
                                          key={sIdx}
                                          style={{
                                            padding: "16px",
                                            borderRadius: "var(--radius-xl)",
                                            background: "var(--bg2)",
                                            border: "1px solid var(--border)",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              justifyContent: "space-between",
                                              alignItems: "center",
                                              marginBottom: "10px",
                                              borderBottom:
                                                "1px solid var(--border)",
                                              paddingBottom: "8px",
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontWeight: 800,
                                                color: "var(--primary-on-tint)",
                                                fontSize: "1rem",
                                              }}
                                            >
                                              {mealTitles[slotKey] || slotKey}
                                            </span>
                                            {slotData.time && (
                                              <span
                                                style={{
                                                  fontSize: "0.8rem",
                                                  background: "var(--bg3)",
                                                  padding: "2px 8px",
                                                  borderRadius:
                                                    "var(--radius-xs)",
                                                  color:
                                                    "var(--text-secondary)",
                                                }}
                                              >
                                                ⏰ {slotData.time}
                                              </span>
                                            )}
                                          </div>
                                          {!slotData.items ||
                                          slotData.items.length === 0 ? (
                                            <span
                                              style={{
                                                fontSize: "0.85rem",
                                                color: "var(--text-secondary)",
                                              }}
                                            >
                                              غير محدد
                                            </span>
                                          ) : (
                                            <ul
                                              style={{
                                                margin: "8px 0 0 0",
                                                paddingRight: "20px",
                                                fontSize: "0.95rem",
                                                color: "var(--text)",
                                                lineHeight: "1.7",
                                              }}
                                            >
                                              {slotData.items.map(
                                                (
                                                  mItem: any,
                                                  itemIdx: number,
                                                ) => {
                                                  const weightVal =
                                                    mItem.weight != null
                                                      ? Math.round(
                                                          mItem.weight * 10,
                                                        ) / 10
                                                      : Math.round(
                                                          (mItem.qty || 1) *
                                                            100 *
                                                            10,
                                                        ) / 10;
                                                  const qtyVal =
                                                    mItem.qty != null
                                                      ? mItem.qty
                                                      : 1;
                                                  const unit =
                                                    mItem.unit || "غرام";
                                                  const prefix =
                                                    unit === "غرام" ||
                                                    unit === "كغم"
                                                      ? "الوزن"
                                                      : "الكمية";
                                                  const unitSuffix =
                                                    unit === "بدون وحدة قياس"
                                                      ? ""
                                                      : ` ${unit}`;
                                                  const parts: string[] = [];
                                                  if (qtyVal > 0)
                                                    parts.push(
                                                      `العدد: ${qtyVal}`,
                                                    );
                                                  if (weightVal > 0)
                                                    parts.push(
                                                      `${prefix}: ${weightVal}${unitSuffix}`,
                                                    );
                                                  const portionText =
                                                    parts.length > 0
                                                      ? parts.join(" | ")
                                                      : "حسب الرغبة";
                                                  return (
                                                    <li
                                                      key={itemIdx}
                                                      style={{
                                                        marginBottom: "8px",
                                                      }}
                                                    >
                                                      <div
                                                        style={{
                                                          display:
                                                            "inline-flex",
                                                          alignItems: "center",
                                                          gap: "10px",
                                                          flexWrap: "wrap",
                                                        }}
                                                      >
                                                        <span
                                                          style={{
                                                            fontWeight: 800,
                                                          }}
                                                        >
                                                          {mItem.name ||
                                                            mItem.label ||
                                                            "صنف غذائي"}
                                                        </span>
                                                        <span
                                                          style={{
                                                            background:
                                                              "color-mix(in srgb, var(--primary) 15%, transparent)",
                                                            color:
                                                              "var(--primary-on-tint)",
                                                            border:
                                                              "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                                                            padding: "2px 10px",
                                                            borderRadius:
                                                              "var(--radius-sm)",
                                                            fontSize: "0.82rem",
                                                            fontWeight: 800,
                                                          }}
                                                        >
                                                          {portionText}
                                                        </span>
                                                      </div>
                                                    </li>
                                                  );
                                                },
                                              )}
                                            </ul>
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable Comprehensive Profile Data & Measurements */}
                  {isInfoOpen && (
                    <div
                      style={{
                        background: "var(--bg1)",
                        borderTop: "1px solid var(--border)",
                        padding: "28px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "24px",
                        }}
                      >
                        <h4
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: 800,
                            color: "var(--primary-on-tint)",
                            margin: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <span>📋</span>
                          <span>
                            الملف الرياضي والقياسات الشاملة للمتدرب (
                            {item.monthName})
                          </span>
                        </h4>
                        <button
                          onClick={() => setSelectedInfoMonth(null)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "1.6rem",
                          }}
                          title="إغلاق"
                        >
                          &times;
                        </button>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "28px",
                        }}
                      >
                        {/* Basic Info & Indicators Grid */}
                        <div>
                          <h5
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 800,
                              color: "var(--text)",
                              margin: "0 0 14px 0",
                              borderRight: "4px solid var(--primary)",
                              paddingRight: "10px",
                            }}
                          >
                            📌 المؤشرات البدنية والبيانات الشخصية
                          </h5>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(160px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                الاسم الكامل
                              </div>
                              <div
                                style={{
                                  fontSize: "1.05rem",
                                  color: "var(--text)",
                                  fontWeight: 800,
                                  marginTop: "2px",
                                }}
                              >
                                {profile.fullname || "المشترك"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                الخطة المشترك بها
                              </div>
                              <div
                                style={{
                                  fontSize: "0.95rem",
                                  fontWeight: 800,
                                  color: getPlanTextColor(profile.plan || raw.plan),
                                  background: getPlanColor(profile.plan || raw.plan),
                                  padding: "4px 12px",
                                  borderRadius: "var(--radius-sm)",
                                  display: "inline-block",
                                  border: `1px solid ${getPlanColor(profile.plan || raw.plan)}`,
                                  marginTop: "6px",
                                }}
                              >
                                {planLabel(
                                  profile.plan || raw.plan,
                                  "خطة تدريب وتغذية",
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                الهدف الرياضي
                              </div>
                              <div
                                style={{
                                  fontSize: "1.05rem",
                                  color: "var(--text)",
                                  fontWeight: 800,
                                  marginTop: "2px",
                                }}
                              >
                                {answerLabel(
                                  profile.goal || raw.sub_goal || raw.goal,
                                  "تحسين اللياقة",
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                الوزن الحالي
                              </div>
                              <div
                                style={{
                                  fontSize: "1.05rem",
                                  color: "var(--text)",
                                  fontWeight: 800,
                                  marginTop: "2px",
                                }}
                              >
                                {profile.weight || raw.weight
                                  ? `${profile.weight || raw.weight} كجم`
                                  : "—"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                الوزن المستهدف
                              </div>
                              <div
                                style={{
                                  fontSize: "1.05rem",
                                  color: "var(--primary-on-tint)",
                                  fontWeight: 800,
                                  marginTop: "2px",
                                }}
                              >
                                {raw.target_weight
                                  ? `${raw.target_weight} كجم`
                                  : "—"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                الطول
                              </div>
                              <div
                                style={{
                                  fontSize: "1.05rem",
                                  color: "var(--text)",
                                  fontWeight: 800,
                                  marginTop: "2px",
                                }}
                              >
                                {profile.height || raw.height
                                  ? `${profile.height || raw.height} سم`
                                  : "—"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                العمر
                              </div>
                              <div
                                style={{
                                  fontSize: "1.05rem",
                                  color: "var(--text)",
                                  fontWeight: 800,
                                  marginTop: "2px",
                                }}
                              >
                                {profile.age || raw.age
                                  ? `${profile.age || raw.age} سنة`
                                  : "—"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--text-secondary)",
                                  fontWeight: 600,
                                }}
                              >
                                النشاط اليومي
                              </div>
                              <div
                                style={{
                                  fontSize: "1.05rem",
                                  color: "var(--text)",
                                  fontWeight: 800,
                                  marginTop: "2px",
                                }}
                              >
                                {activityLabel(
                                  profile.activity || raw.activity,
                                  "متوسط",
                                )}
                              </div>
                            </div>
                            {raw.residence && (
                              <div
                                style={{
                                  background: "var(--bg2)",
                                  padding: "14px 16px",
                                  borderRadius: "var(--radius-lg)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  محل الإقامة
                                </div>
                                <div
                                  style={{
                                    fontSize: "1.05rem",
                                    color: "var(--text)",
                                    fontWeight: 800,
                                    marginTop: "2px",
                                  }}
                                >
                                  {raw.residence}
                                </div>
                              </div>
                            )}
                            {raw.employment && (
                              <div
                                style={{
                                  background: "var(--bg2)",
                                  padding: "14px 16px",
                                  borderRadius: "var(--radius-lg)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  المهنة أو طبيعة العمل
                                </div>
                                <div
                                  style={{
                                    fontSize: "1.05rem",
                                    color: "var(--text)",
                                    fontWeight: 800,
                                    marginTop: "2px",
                                  }}
                                >
                                  {raw.employment}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Body Measurements Grid - Females only */}
                        {isFemale && (
                          <div>
                            <h5
                              style={{
                                fontSize: "1.05rem",
                                fontWeight: 800,
                                color: "var(--text)",
                                margin: "0 0 14px 0",
                                borderRight: "4px solid var(--primary)",
                                paddingRight: "10px",
                              }}
                            >
                              ⚖️ القياسات الجسدية ومحيط العضلات
                            </h5>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(130px, 1fr))",
                                gap: "12px",
                                background: "var(--bg2)",
                                padding: "18px",
                                borderRadius: "var(--radius-xl)",
                                border:
                                  "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                              }}
                            >
                              <div style={{ textAlign: "center" }}>
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  محيط الذراع
                                </div>
                                <div
                                  style={{
                                    fontSize: "1.15rem",
                                    fontWeight: 800,
                                    color: "var(--text)",
                                    marginTop: "4px",
                                  }}
                                >
                                  {meas.arm || meas.bicep || "—"}
                                </div>
                              </div>
                              <div
                                style={{
                                  textAlign: "center",
                                  borderInlineStart: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  محيط الخصر
                                </div>
                                <div
                                  style={{
                                    fontSize: "1.15rem",
                                    fontWeight: 800,
                                    color: "var(--text)",
                                    marginTop: "4px",
                                  }}
                                >
                                  {meas.waist || "—"}
                                </div>
                              </div>
                              <div
                                style={{
                                  textAlign: "center",
                                  borderInlineStart: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  محيط الحوض
                                </div>
                                <div
                                  style={{
                                    fontSize: "1.15rem",
                                    fontWeight: 800,
                                    color: "var(--text)",
                                    marginTop: "4px",
                                  }}
                                >
                                  {meas.hips || "—"}
                                </div>
                              </div>
                              <div
                                style={{
                                  textAlign: "center",
                                  borderInlineStart: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  محيط الفخذ
                                </div>
                                <div
                                  style={{
                                    fontSize: "1.15rem",
                                    fontWeight: 800,
                                    color: "var(--text)",
                                    marginTop: "4px",
                                  }}
                                >
                                  {meas.thigh || meas.leg || "—"}
                                </div>
                              </div>
                              <div
                                style={{
                                  textAlign: "center",
                                  borderInlineStart: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  محيط الصدر
                                </div>
                                <div
                                  style={{
                                    fontSize: "1.15rem",
                                    fontWeight: 800,
                                    color: "var(--text)",
                                    marginTop: "4px",
                                  }}
                                >
                                  {meas.chest || "—"}
                                </div>
                              </div>
                              <div
                                style={{
                                  textAlign: "center",
                                  borderInlineStart: "1px solid var(--border)",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "0.78rem",
                                    color: "var(--text-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  محيط الأكتاف
                                </div>
                                <div
                                  style={{
                                    fontSize: "1.15rem",
                                    fontWeight: 800,
                                    color: "var(--text)",
                                    marginTop: "4px",
                                  }}
                                >
                                  {meas.shoulders || "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Meal Schedule & Nutrition Grid */}
                        <div>
                          <h5
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 800,
                              color: "var(--text)",
                              margin: "0 0 14px 0",
                              borderRight: "4px solid var(--primary)",
                              paddingRight: "10px",
                            }}
                          >
                            🍽️ التغذية ومواعيد الوجبات المفضلة
                          </h5>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(200px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.82rem",
                                  marginBottom: "4px",
                                }}
                              >
                                فطور أيام العمل:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.workday_breakfast, "غير محدد")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.82rem",
                                  marginBottom: "4px",
                                }}
                              >
                                غداء أيام العمل:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.workday_lunch, "غير محدد")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.82rem",
                                  marginBottom: "4px",
                                }}
                              >
                                عشاء أيام العمل:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.workday_dinner, "غير محدد")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.82rem",
                                  marginBottom: "4px",
                                }}
                              >
                                فطور العطل والإجازات:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.holiday_breakfast, "غير محدد")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.82rem",
                                  marginBottom: "4px",
                                }}
                              >
                                غداء العطل والإجازات:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.holiday_lunch, "غير محدد")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "14px 16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.82rem",
                                  marginBottom: "4px",
                                }}
                              >
                                عشاء العطل والإجازات:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.holiday_dinner, "غير محدد")}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Preferences & Habits */}
                        <div>
                          <h5
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 800,
                              color: "var(--text)",
                              margin: "0 0 14px 0",
                              borderRight: "4px solid var(--primary)",
                              paddingRight: "10px",
                            }}
                          >
                            🥗 التفضيلات والعادات الغذائية
                          </h5>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                                gridColumn: "span 2 / auto",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 800,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                الأكلات المفضلة:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {raw.fav_foods || "لم يذكر"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--primary-on-tint)",
                                  fontWeight: 800,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                أطعمة مستبعدة أو حساسية:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerList(
                                  profile.allergies || raw.allergies,
                                  "لا يوجد",
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                أنواع اللحوم المفضلة:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerList(raw.meat, "عام")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                معدل القهوة اليومي:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.coffee_rate, "طبيعي")}
                                {raw.coffee_type ? ` (${raw.coffee_type})` : ""}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                الرغبة في شراء المكملات:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.buy_supp, "غير محدد")}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Workout Commitment & Experience */}
                        <div>
                          <h5
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 800,
                              color: "var(--text)",
                              margin: "0 0 14px 0",
                              borderRight: "4px solid var(--primary)",
                              paddingRight: "10px",
                            }}
                          >
                            🏋️‍♂️ الالتزام الرياضي وخبرة التمرين
                          </h5>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(200px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                مكان التمرين المختار:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(
                                  raw.workout_commit ||
                                    raw.workout_location ||
                                    raw.location,
                                  "الجيم / النادي الرياضي",
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                خبرة التمرين السابقة:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.workout_exp, "متوسط")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                أنواع التمارين السابقة:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerList(raw.workout_type_exp, "عام")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                أيام الالتزام الأسبوعية:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.workout_days, "حسب الجدول")}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                مواعيد وفترات التمرين:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerLabel(raw.gym_time, "أوقات مرنة")}
                              </div>
                            </div>
                            {raw.workout_type_other_desc && (
                              <div
                                style={{
                                  background: "var(--bg2)",
                                  padding: "16px",
                                  borderRadius: "var(--radius-lg)",
                                  border: "1px solid var(--border)",
                                  gridColumn: "1 / -1",
                                }}
                              >
                                <div
                                  style={{
                                    color: "var(--text-secondary)",
                                    fontWeight: 700,
                                    fontSize: "0.85rem",
                                    marginBottom: "4px",
                                  }}
                                >
                                  ملاحظات أو رياضات أخرى:
                                </div>
                                <div
                                  style={{
                                    color: "var(--text)",
                                    fontWeight: 700,
                                  }}
                                >
                                  {raw.workout_type_other_desc}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Health & Diet History Grid */}
                        <div>
                          <h5
                            style={{
                              fontSize: "1.05rem",
                              fontWeight: 800,
                              color: "var(--text)",
                              margin: "0 0 14px 0",
                              borderRight: "4px solid var(--primary)",
                              paddingRight: "10px",
                            }}
                          >
                            🩺 الملف الصحي وتاريخ التغذية والدايت
                          </h5>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(260px, 1fr))",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--primary-on-tint)",
                                  fontWeight: 800,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                المشاكل الصحية أو الإصابات السابقة:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {answerList(
                                  raw.injuries || raw.health_issues,
                                  "لا توجد مشاكل صحية (سليم)",
                                )}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                المكملات الغذائية المستخدمة حالياً:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {raw.supplements_list || "لا يوجد"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                تجارب وأنظمة الدايت السابقة:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {raw.diet_history || "لا يوجد"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                سبب فشل أو تعثر الدايت الأخير:
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {raw.last_diet_fail || "لا يوجد"}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "var(--bg2)",
                                padding: "16px",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                                gridColumn: "1 / -1",
                              }}
                            >
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 700,
                                  fontSize: "0.85rem",
                                  marginBottom: "4px",
                                }}
                              >
                                أسباب ودوافع تناول الطعام (توتر/عادات...):
                              </div>
                              <div
                                style={{
                                  color: "var(--text)",
                                  fontWeight: 700,
                                }}
                              >
                                {raw.eating_reason || "لا يوجد"}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: "center", marginTop: "10px" }}>
                          <a
                            href={`/export-profile?profileId=${profile.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "12px 28px",
                              borderRadius: "var(--radius-lg)",
                              background: "var(--primary)",
                              color: "var(--text-inverse)",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "10px",
                              fontWeight: 800,
                              fontSize: "1rem",
                            }}
                          >
                            <Icon
                              name="file_download"
                              style={{ fontSize: "22px" }}
                            />
                            <span>
                              تحميل التقرير الشامل لكافة المعلومات والقياسات PDF
                            </span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
