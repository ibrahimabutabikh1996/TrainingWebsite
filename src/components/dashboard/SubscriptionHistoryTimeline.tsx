"use client";

import React, { useState } from "react";
import type { JsonRecord, UserProfile, MonthlyArchive } from "@/types";
import { Icon } from "@/components/Icon";
import toast from "react-hot-toast";
import {
  deleteMonthHistoryAction,
  deleteEntireHistoryAction,
  restoreHistoryAction,
} from "@/app/admin/profile/actions";
import { DEFAULT_PLAN_NAMES, type PlanNames } from "@/lib/planNames";
import { buildSubscriptionMonths } from "@/lib/subscriptionMonths";
import { MonthSection } from "@/components/admin/ProfileMonthlyRecord";
import WorkoutProgress, { type WorkoutLogRow } from "@/components/admin/WorkoutProgress";
import WeightLog from "@/components/dashboard/WeightLog";
import { confirmDialog } from "@/lib/confirmDialog";

/* Whether an ISO date falls inside a month of the subscription.
 *
 * The bounds are `YYYY-MM-DD` strings and so is every date being tested, so this
 * is a string comparison — no Date parsing, no timezone to get wrong. An open
 * end means the month still running, which has no upper bound yet.
 *
 * This is what makes a month readable on its own: the weights and the weigh-ins
 * shown under it are the ones recorded during it, not a running total that
 * happens to be displayed there. */
const withinMonth = (date: string, start: string, end: string) => {
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
};

interface Props {
  profile: UserProfile;
  isAdminView?: boolean;
  /* Every weight the trainee logged, read by the server component above and
     split per month here. Absent on any tree that does not supply it, which
     simply means no weights are shown. */
  workoutLogs?: WorkoutLogRow[];
  /* The coach's names for the packages. Optional with the dictionary as the
     default, because this renders inside two different trees and only the one
     with a server component above it can supply them. */
  planNames?: PlanNames;
}

export function SubscriptionHistoryTimeline({
  profile,
  planNames = DEFAULT_PLAN_NAMES,
  isAdminView = false,
  workoutLogs = [],
}: Props) {
  /* Only the subscriber's own details still open in place. The training sheet
     and the diet used to expand here too, each behind its own "view" button
     beside a "download" one; both cards now carry a single button that opens
     the page the sheet is actually printed from, so the two panels and the
     state that drove them are gone. */
  const [selectedInfoMonth, setSelectedInfoMonth] = useState<number | null>(
    null,
  );
  const [openMonths, setOpenMonths] = useState<Record<number, boolean>>({});

  /* The intake blob and the measurements inside it. JsonRecord is the project's
     one documented escape hatch for a shape the form decides — see @/types. */
  const raw = (profile.raw_answers || {}) as JsonRecord;
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
                await confirmDialog(
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

  /* The same month list `ProfileMonthlyRecord` builds, from the same function
     and the same blob — so the record shown inside a month here is the record
     that panel showed for it, not a second reading of the archive. Matched to
     the timeline's own months by number, because the timeline's list omits the
     months the coach has hidden and this one does not. */
  const recordMonths = buildSubscriptionMonths(raw, profile.created_at ?? null);

  /* Every weigh-in the trainee recorded, as the chart component wants them. */
  const allWeightLogs = Array.isArray(raw.weightLogs)
    ? (raw.weightLogs as { date: string; weight: number }[]).filter(
        (l) => l && typeof l.date === "string" && typeof l.weight === "number",
      )
    : [];

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
            {/* The strapline under the heading is gone — both arms of it. The
                second was the non-admin wording, and this component is only ever
                rendered with `isAdminView` set: the trainee's dashboard draws
                TraineeProfileDetails instead. Deleting only the arm that shows
                would have left a paragraph that renders nothing. */}
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
                  await confirmDialog(
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
                    await confirmDialog(
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
          const isInfoOpen = selectedInfoMonth === item.monthNumber;

          /* This month's own three slices.
           *
             `monthIndex` is the position in `history` that the delete actions
             edit — the month still running has no entry there, hence null. */
          const recordIndex = recordMonths.findIndex(
            (m) => m.monthNumber === item.monthNumber,
          );
          const recordMonth = recordIndex >= 0 ? recordMonths[recordIndex] : null;
          const monthRecord = recordMonth
            ? {
                month: recordMonth,
                index: recordMonth.isCurrent ? null : recordIndex,
              }
            : null;

          const monthWorkoutRows = workoutLogs.filter((r) =>
            withinMonth(r.session_date, item.startDate, item.endDate),
          );
          const monthWeightLogs = allWeightLogs.filter((l) =>
            withinMonth(l.date, item.startDate, item.endDate),
          );
          /* The weight the trainee reported when this month began — the answer
             on that month's own form, not their first ever. */
          const monthStartWeight = recordMonth?.data?.weight as
            | string
            | number
            | undefined;
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
                      className="timeline-danger-btn"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (
                          await confirmDialog(
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
                      /* `min(280px, 100%)`, not a bare 280px. A bare minimum is
                         a floor the track cannot go under even when the
                         container is narrower than it, so on a 320px phone
                         these columns resolved to 280px inside about 200px of
                         room — and the month card above sets `overflow: hidden`
                         to clip its own rounded header, which turned the
                         overflow into 103px of silently unreachable content:
                         the subscriber's name, and both "open the download
                         page" buttons. `min()` lets the floor collapse to the
                         container on screens narrower than the floor, which is
                         the same fix `.home-stats-grid` and `.ui-grid-2`
                         already use. Above 280px nothing changes. */
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
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
                        border: "1px solid var(--border)",
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
                              النظام التدريبي
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
                      </div>

                      <div className="timeline-card-actions">
                        {/* No course assigned to this month means there is no
                            training sheet to print. This used to fall back to
                            /export-profile — the trainee's measurements and
                            questionnaire, which is not a training programme and
                            is not what the button says it is. Saying so plainly
                            is better than opening the wrong page. */}
                        {item.workout?.courseId ? (
                          /* Both keys, not just the course.
                             The sheet prints "الاسم / تاريخ الاشتراك / الوزن /
                             الطول / الهدف" across the top, and the page fills
                             those from the profile — so a link carrying only the
                             course produced a correct programme under a header
                             that read "المشترك" and three dashes. Passing the
                             profile too is what puts the subscriber on their own
                             sheet. `traineeMayPrint` now checks every key it is
                             given, so naming the profile here cannot widen what
                             the caller may print. */
                          <a
                            href={`/export-workout?courseId=${item.workout.courseId}&profileId=${profile.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
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
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              whiteSpace: "nowrap",
                              transition:
                                "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur-fast) var(--ease)",
                              "--t-color-idle": "var(--primary)",
                            } as React.CSSProperties}
                            title="فتح صفحة تحميل النظام التدريبي"
                          >
                            <Icon name="fitness_center" style={{ fontSize: "22px" }} />
                            <span>فتح صفحة التحميل</span>
                          </a>
                        ) : (
                          <span
                            style={{
                              flex: 1,
                              height: "46px",
                              padding: "0 16px",
                              borderRadius: "var(--radius-lg)",
                              background: "var(--bg2)",
                              color: "var(--text-secondary)",
                              border: "1px dashed var(--border)",
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              whiteSpace: "nowrap",
                            }}
                            title="لا يوجد كورس مُسنَد لهذا الشهر"
                          >
                            <Icon name="fitness_center" style={{ fontSize: "20px" }} />
                            <span>لم يُسند كورس لهذا الشهر</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Diet Plan Box */}
                    <div
                      className="timeline-card"
                      style={{
                        padding: "22px",
                        borderRadius: "var(--radius-xl)",
                        background: "var(--bg3)",
                        border: "1px solid var(--border)",
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
                              النظام الغذائي
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
                            {/* Was a calorie figure with this as its fallback,
                                and the figure never arrived: neither builder of
                                this timeline — the panel's nor the export's —
                                sets `diet.calories`, so the branch had been
                                dead since it was written. The macros behind it
                                are no longer collected either. */}
                            نظام غذائي مخصص
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
                      </div>

                      <div className="timeline-card-actions">
                        <a
                          href={`/export-diet?profileId=${profile.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
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
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            whiteSpace: "nowrap",
                            transition:
                              "background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), transform var(--dur-fast) var(--ease)",
                            "--t-color-idle": "var(--success-text)",
                          } as React.CSSProperties}
                          title="فتح صفحة تحميل النظام الغذائي"
                        >
                          <Icon name="restaurant" style={{ fontSize: "22px" }} />
                          <span>فتح صفحة التحميل</span>
                        </a>
                      </div>
                    </div>

                    {/* Comprehensive Data & Measurements Box */}
                    {/* Shown in every month, not only the first.
                        It was restricted to month one while it held a single
                        profile-wide dump of the intake answers — one copy of
                        which was enough. It now holds that month's own record,
                        so every month has one. */}
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
                              معلومات المشترك
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
                      </div>

                      <div className="timeline-card-actions">
                        <button
                          onClick={() =>
                            setSelectedInfoMonth(
                              isInfoOpen ? null : item.monthNumber,
                            )
                          }
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
                          title={isInfoOpen ? "إخفاء المعلومات" : "عرض المعلومات"}
                        >
                          <Icon
                            name={isInfoOpen ? "close" : "description"}
                            style={{ fontSize: "22px" }}
                          />
                          <span>
                            {isInfoOpen ? "إخفاء المعلومات" : "عرض المعلومات"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* This month's own record: its answers and attachments, the
                      weights lifted during it, and the weigh-ins recorded in it.
                      Everything here is narrowed to the month's own dates, so a
                      month is read on its own rather than against a running
                      total — see `monthWindow`. */}
                  {isInfoOpen && (
                    <div
                      style={{
                        background: "var(--bg1)",
                        borderTop: "1px solid var(--border)",
                        padding: "24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "24px",
                      }}
                    >
                      {/* No heading and no close button of its own.
                          Both repeated what was already directly above: the card
                          that opens this panel names the month, and its button
                          reads "إخفاء المعلومات" and calls the same
                          `setSelectedInfoMonth(null)` this one did. The month is
                          still named — the first tab below carries its label. */}

                      {/* The month's answers and files — the very component the
                          standalone "سجل الأشهر" panel was built from, so the two
                          cannot drift into showing a month differently. */}
                      {monthRecord ? (
                        <MonthSection
                          month={monthRecord.month}
                          monthIndex={monthRecord.index}
                          profileId={profile.id}
                          planNames={planNames}
                        />
                      ) : null}

                      <WorkoutProgress
                        rows={monthWorkoutRows}
                        emptyNote={`لم تُسجَّل أي أوزان تمارين خلال ${item.monthName}.`}
                      />

                      {/* Wrapped here rather than inside `WeightLog`, which the
                          trainee's dashboard also renders as a full page section
                          — collapsing it there is not wanted. The tab is the
                          caller's decision, so it is made at the call site, and
                          `embedded` only drops the heading this summary already
                          carries. */}
                      <details
                        className="crm-modal-section"
                        style={{
                          background: "var(--bg2)",
                          padding: "24px",
                          borderRadius: "var(--radius-xl)",
                          /* Matches its two siblings — see `MonthSection`. */
                          border: "1px solid var(--border-strong)",
                        }}
                      >
                        <summary
                          className="crm-modal-section-title"
                          style={{
                            margin: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <Icon
                              name="monitor_weight"
                              style={{ color: "var(--primary)", fontSize: "24px" }}
                            />
                            <span
                              style={{ fontSize: "1.2rem", color: "var(--text)", fontWeight: 700 }}
                            >
                              سجل الوزن الأسبوعي
                            </span>
                            <span
                              className="crm-tag"
                              style={{ fontSize: "0.8rem", padding: "2px 10px", borderRadius: "var(--radius-lg)" }}
                            >
                              {monthWeightLogs.length} قراءة
                            </span>
                          </div>
                          <Icon
                            name="expand_more"
                            className="accordion-icon"
                            style={{ color: "var(--text-muted)" }}
                          />
                        </summary>

                        <div style={{ marginTop: "24px" }}>
                          <WeightLog
                            profile={{
                              id: profile.id,
                              weightLogs: monthWeightLogs,
                              /* The month's own opening weight, not the trainee's
                                 first ever: each renewal form carries the weight
                                 they were at when that month began, and that is
                                 what the chart should start from here. */
                              weight: monthStartWeight,
                              created_at: item.startDate || undefined,
                            }}
                            readonly
                            embedded
                          />
                        </div>
                      </details>
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
