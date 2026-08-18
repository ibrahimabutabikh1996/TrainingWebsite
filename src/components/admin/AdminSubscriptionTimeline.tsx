import React from "react";
import { prisma } from "@/lib/db";
import { asMeals, type DietPlan } from "@/types/diet";
import { readIntakeData } from "@/lib/intakeData";
import { toISODate } from "@/lib/trainingCycle";
import { planLabel, activityLabel, answerLabel, answerList } from "@/lib/formLabels";
import type { MonthlyArchive, UserProfile, JsonRecord } from "@/types";
import type { Day } from "@/types/admin";
import { SubscriptionHistoryTimeline } from "@/components/dashboard/SubscriptionHistoryTimeline";
import { Icon } from "@/components/Icon";

interface Props {
  profileId: string;
}

/**
 * Everything the timeline needs, or null if it cannot be assembled.
 *
 * Split out from the component so the `try` covers the queries and the shaping
 * — the things that can actually fail here — and not the JSX. Wrapping the
 * markup too, as this file used to, catches nothing extra: a component throws
 * while React renders it, long after this function has returned, so the `catch`
 * never sees it. What it did instead was make the whole panel disappear on any
 * database hiccup and claim, in the log line, that the timeline had failed to
 * generate. Rendering failures belong to an error boundary; this belongs here.
 */
async function loadTimeline({ profileId }: Props) {
  try {
    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      include: { courses: true },
    });

    if (!profile) return null;

    /* Handed to the timeline as `raw_answers`, so it reaches the browser whole. */
    const data: JsonRecord = readIntakeData(profile.data);

    let courseData = null;
    if (profile.courses) {
      courseData = typeof profile.courses.days_data === "string"
        ? JSON.parse(profile.courses.days_data)
        : (profile.courses.days_data || null);
    }

    const dietPlanRows = await prisma.diet_plans.findMany({
      where: { profile_id: profile.id },
      orderBy: { position: "asc" },
      select: { id: true, name: true, position: true, meals_data: true },
    });

    const dietPlans: DietPlan[] = dietPlanRows.map((row) => ({
      id: row.id,
      name: row.name,
      position: row.position,
      meals: asMeals(row.meals_data),
    }));


    const clientCourses = await prisma.client_courses.findMany({
      where: { client_id: profile.id },
      include: { courses: true },
      orderBy: { assigned_at: "asc" },
    });

    const defaultWorkouts: Day[] = Array.isArray(courseData) ? courseData : (courseData?.workouts || []);
    const defaultCourseName = profile.courses?.name || "البرنامج التدريبي المخصص للمتدرب";

    const regDateStr = data.activation_date || (profile.created_at ? profile.created_at.toISOString() : null);
    const regDate = regDateStr ? new Date(regDateStr) : new Date();
    const now = new Date();

    const diffMs = now.getTime() - regDate.getTime();
    const totalDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const totalMonths = Math.max(1, Math.floor(totalDays / 30) + 1);

    const monthNamesAr = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
    const monthlyHistory: MonthlyArchive[] = [];
    const deletedMonths = Array.isArray(data.deleted_months) ? (data.deleted_months as number[]) : [];
    const deleteAllHistory = Boolean(data.delete_all_history);

    for (let m = 1; m <= totalMonths; m++) {
      if (deleteAllHistory || deletedMonths.includes(m)) {
        continue;
      }
      const start = new Date(regDate.getTime() + (m - 1) * 30 * 86400000);
      const end = new Date(regDate.getTime() + m * 30 * 86400000);
      const isCurrent = m === totalMonths;

      const arabicIdx = m - 1;
      const monthTitle = arabicIdx < monthNamesAr.length
        ? `الشهر ${monthNamesAr[arabicIdx]}`
        : `الشهر رقم ${m}`;

      let matchedCourseName = defaultCourseName;
      let matchedDays: Day[] = defaultWorkouts;
      let matchedCourseId = profile.courses?.id;

      if (clientCourses.length > 0) {
        const matched = clientCourses.find(cc => {
          const assignedTime = new Date(cc.assigned_at).getTime();
          return assignedTime <= end.getTime() && assignedTime >= start.getTime();
        }) || (m <= clientCourses.length ? clientCourses[m - 1] : clientCourses[clientCourses.length - 1]);

        if (matched && matched.courses) {
          matchedCourseId = matched.courses.id;
          matchedCourseName = matched.courses.name;
          const parsedDays = typeof matched.courses.days_data === "string"
            ? JSON.parse(matched.courses.days_data)
            : (matched.courses.days_data || null);
          matchedDays = Array.isArray(parsedDays) ? parsedDays : (parsedDays?.workouts || []);
        }
      }

      monthlyHistory.push({
        monthNumber: m,
        monthName: monthTitle,
        startDate: toISODate(start),
        endDate: toISODate(end),
        status: isCurrent ? "current" : "completed",
        workout: matchedDays.length > 0 ? {
          courseId: matchedCourseId,
          courseName: matchedCourseName,
          daysCount: matchedDays.length,
          daysData: matchedDays,
        } : null,
        diet: dietPlans.length > 0 ? {
          name: dietPlans[0].name || "النظام الغذائي المخصص",
          mealsData: dietPlans,
        } : null,
      });
    }

    const mockProfile = {
      id: profile.id,
      fullname: data.fullname || profile.username || "المشترك",
      plan: planLabel(data.plan, "خطة تدريب وتغذية"),
      age: data.age || "غير محدد",
      weight: data.weight || "غير محدد",
      height: data.height || "غير محدد",
      activity: activityLabel(data.activity, "متوسط"),
      goal: answerLabel(data.sub_goal || data.goal, "غير محدد"),
      gender: data.gender || "male",
      allergies: answerList(data.allergies, "لا يوجد"),
      measurements: data.measurements || null,
      raw_answers: data,
      created_at: profile.created_at ? profile.created_at.toISOString() : undefined,
      activation_date: data.activation_date || (profile.created_at ? profile.created_at.toISOString() : null),
      subscription_ends_at: profile.subscription_ends_at ? profile.subscription_ends_at.toISOString() : null,
      monthlyHistory,
    } as unknown as UserProfile;

    return { mockProfile, monthCount: monthlyHistory.length };
  } catch (err) {
    console.error("Failed to load the admin subscription timeline:", err);
    return null;
  }
}

export default async function AdminSubscriptionTimeline({ profileId }: Props) {
  const loaded = await loadTimeline({ profileId });
  if (!loaded) return null;

  const { mockProfile, monthCount } = loaded;

  return (
    <details
      className="crm-modal-section"
      style={{
        background: "var(--bg2)",
        padding: "24px",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      }}
      open
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
          listStyle: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Icon name="calendar_month" style={{ color: "var(--primary)", fontSize: "26px" }} />
          <span style={{ fontSize: "1.3rem", color: "var(--text)", fontWeight: 800 }}>
            السجل التاريخي (سجل الاشتراكات والأنظمة السابقة)
          </span>
          <span className="crm-tag primary-tag" style={{ fontSize: "0.85rem", padding: "2px 10px", borderRadius: "var(--radius-lg)" }}>
            {monthCount} أشهر مجدولة
          </span>
        </div>
        <Icon name="expand_more" className="accordion-icon" style={{ color: "var(--text-muted)" }} />
      </summary>

      <div style={{ marginTop: "16px" }}>
        <SubscriptionHistoryTimeline profile={mockProfile} isAdminView={true} />
      </div>
    </details>
  );
}
