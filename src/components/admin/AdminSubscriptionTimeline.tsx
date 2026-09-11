import React from "react";
import { prisma } from "@/lib/db";
import { asMeals, type DietPlan } from "@/types/diet";
import { readIntakeData } from "@/lib/intakeData";
import { toISODate } from "@/lib/trainingCycle";
import { activityLabel, answerLabel, answerList } from "@/lib/formLabels";
import { planNameFrom, type PlanNames } from "@/lib/planNames";
import { buildSubscriptionMonths } from "@/lib/subscriptionMonths";
import type { MonthlyArchive, UserProfile, JsonRecord } from "@/types";
import type { Day } from "@/types/admin";
import { SubscriptionHistoryTimeline } from "@/components/dashboard/SubscriptionHistoryTimeline";
import { Icon } from "@/components/Icon";
import type { WorkoutLogRow } from "@/components/admin/WorkoutProgress";

interface Props {
  profileId: string;
  planNames: PlanNames;
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
async function loadTimeline({ profileId, planNames }: Props) {
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

    /* The months the subscription actually had, from the renewals that created
       them. This used to be arithmetic on the calendar — one month per thirty
       days since registration — which disagreed with the details tabs below,
       where a month has always meant a renewal. Two panels on one page, two
       answers to how long somebody had been subscribed. See
       @/lib/subscriptionMonths. */
    /* Every weight the trainee logged, read here rather than in the component
       that draws them.
     *
       `WorkoutProgress` used to run this query itself and render on the server.
       It now sits inside each month of the timeline, and the timeline is a
       client component — which cannot render an async server component. So the
       query lives here, on the same page and behind the same `requireAdminPage`
       guard it was always protected by, and the rows are handed down to be
       split per month.

       A failure is logged and left as an empty list: a profile page that cannot
       show the weights is better than one that does not render. */
    let workoutLogs: WorkoutLogRow[] = [];
    try {
      const logs = await prisma.workout_logs.findMany({
        where: { profile_id: profile.id },
        orderBy: [{ session_date: "asc" }, { exercise_name: "asc" }, { set_index: "asc" }],
        select: {
          exercise_id: true,
          exercise_name: true,
          set_index: true,
          reps: true,
          weight: true,
          session_date: true,
        },
      });
      workoutLogs = logs.map((l) => ({
        ...l,
        weight: l.weight === null ? null : Number(l.weight),
        session_date: l.session_date.toISOString().slice(0, 10),
      }));
    } catch (error) {
      console.error("Failed to load workout logs:", error);
    }

    const months = buildSubscriptionMonths(data, profile.created_at);

    const deletedMonths = Array.isArray(data.deleted_months) ? (data.deleted_months as number[]) : [];
    const deleteAllHistory = Boolean(data.delete_all_history);

    /* Newest first, so "the course in effect on that date" is the first match. */
    const coursesNewestFirst = [...clientCourses].reverse();

    const monthlyHistory: MonthlyArchive[] = [];

    for (const month of months) {
      if (deleteAllHistory || deletedMonths.includes(month.monthNumber)) {
        continue;
      }

      /* The course the trainee was on during that month: the last one assigned
         at or before it ended.
       *
         The rule this replaces fell back to `clientCourses[m - 1]` — the m-th
         course for the m-th month — whenever no course had been assigned inside
         the month's own window. That pairing is invented. It put the second
         course in the second month however long the first had actually run, and
         a trainee kept on one course for a year was shown a different programme
         every month. A course stays in effect until another replaces it, so
         that is what is looked up. */
      const asOf = month.endDate ? new Date(month.endDate) : new Date();
      const inEffect = coursesNewestFirst.find(
        (cc) => new Date(cc.assigned_at).getTime() <= asOf.getTime(),
      );

      let courseName = defaultCourseName;
      let days: Day[] = month.isCurrent ? defaultWorkouts : [];
      let courseId = profile.courses?.id;

      if (inEffect?.courses) {
        courseId = inEffect.courses.id;
        courseName = inEffect.courses.name;
        const parsedDays = typeof inEffect.courses.days_data === "string"
          ? JSON.parse(inEffect.courses.days_data)
          : (inEffect.courses.days_data || null);
        days = Array.isArray(parsedDays) ? parsedDays : (parsedDays?.workouts || []);
      }

      monthlyHistory.push({
        monthNumber: month.monthNumber,
        monthName: month.label,
        startDate: month.startDate ? toISODate(new Date(month.startDate)) : "",
        endDate: month.endDate ? toISODate(new Date(month.endDate)) : "",
        status: month.isCurrent ? "current" : "completed",
        workout: days.length > 0 ? {
          courseId,
          courseName,
          daysCount: days.length,
          daysData: days,
        } : null,
        /* Only the month still running.
         *
           Every month used to be handed the same `dietPlans` array — the diets
           that exist right now — which read as a record of what the trainee ate
           in each of them. It is not one. `diet_plans` has no assignment
           history: there is one set of plans per trainee, edited in place, and
           nothing anywhere says which of them was in force last March. Showing
           today's diet under a month that closed before it was written is not a
           duplicate of a fact, it is a fact the database does not hold. */
        diet: month.isCurrent && dietPlans.length > 0 ? {
          name: dietPlans[0].name || "النظام الغذائي المخصص",
          mealsData: dietPlans,
        } : null,
      });
    }

    const mockProfile = {
      id: profile.id,
      fullname: data.fullname || profile.username || "المشترك",
      plan: planNameFrom(planNames, data.plan, "خطة تدريب وتغذية"),
      age: data.age || "غير محدد",
      weight: data.weight || "غير محدد",
      height: data.height || "غير محدد",
      activity: activityLabel(data.activity, "غير محدد"),
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

    return { mockProfile, monthCount: monthlyHistory.length, workoutLogs };
  } catch (err) {
    console.error("Failed to load the admin subscription timeline:", err);
    return null;
  }
}

export default async function AdminSubscriptionTimeline({ profileId, planNames }: Props) {
  const loaded = await loadTimeline({ profileId, planNames });
  if (!loaded) return null;

  const { mockProfile, monthCount, workoutLogs } = loaded;

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
        <SubscriptionHistoryTimeline
          profile={mockProfile}
          isAdminView={true}
          planNames={planNames}
          workoutLogs={workoutLogs}
        />
      </div>
    </details>
  );
}
