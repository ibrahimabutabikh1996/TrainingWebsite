import React from "react";
import { prisma } from "@/lib/db";
import { requireUserPage, sessionOwnsProfile } from "@/lib/authGuard";
import { readIntakeData } from "@/lib/intakeData";
import { asMeals, type DietPlan } from "@/types/diet";
import { toISODate } from "@/lib/trainingCycle";
import { activityLabel, answerLabel, answerList } from "@/lib/formLabels";
import { planNameFrom, resolvePlanNames } from "@/lib/planNames";
import { getLandingContent } from "@/app/admin/cms/actions";
import ExportProfileClient from "./ExportProfileClient";
import { notFound } from "next/navigation";
import type { MonthlyArchive, JsonRecord } from "@/types";
import type { Day } from "@/types/admin";
import { formatTimestamp } from "@/lib/trainingDates";

export const dynamic = "force-dynamic";

export default async function ExportProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>;
}) {
  const session = await requireUserPage();

  const { profileId } = await searchParams;
  if (!profileId) notFound();

  /* The fullest single view of a trainee there is — answers, measurements,
     photos, plans. Same rule as the dashboard it mirrors. */
  if (!(await sessionOwnsProfile(session, profileId))) notFound();

  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    include: { courses: true },
  });
  if (!profile) notFound();

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

  const monthNamesAr = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامِن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
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

  const traineeName = String(data.fullname || profile.username || "المشترك");
  /* From the panel, so an exported PDF names the package the way the site does. */
  const planNames = resolvePlanNames(
    (await getLandingContent())?.content_ar as JsonRecord | undefined
  );
  const plan = planNameFrom(planNames, data.plan, "خطة تدريب وتغذية");
  const goal = answerLabel(data.sub_goal || data.goal, "تطوير البنية العضلية وتحسين اللياقة");
  const age = data.age ? `${data.age} سنة` : "غير محدد";
  const weight = data.weight ? `${data.weight} كجم` : "غير محدد";
  const height = data.height ? `${data.height} سم` : "غير محدد";
  const activity = activityLabel(data.activity, "نشاط يومي متوسط");
  const allergies = answerList(data.allergies, "لا توجد أي حساسيات أو موانع غذائية مسجلة");
  const healthIssues = answerList(data.health_issues || data.injuries, "لا توجد إصابات أو مشاكل صحية (سليم)");
  const dislikedFood = answerList(data.disliked_food || data.fav_foods || data.food_preferences, "لا يوجد");
  const workoutLocation = answerLabel(data.workout_commit || data.workout_location || data.location, "الجيم / صالة الحديد الرياضية");
  const sleepHours = answerLabel(data.workout_days || data.sleep_hours || data.sleep, "حسب جدول التدريب الرياضي");
  const waterIntake = answerLabel(data.gym_time || data.water_intake || data.water, "أوقات مرنة");
  const stressLevel = answerLabel(data.stress_level || data.stress, "طبيعي");
  const experience = answerLabel(data.workout_exp || data.experience || data.training_history, "متوسط");
  const measurements = (data.measurements || {
    arm: data.meas_arm,
    waist: data.meas_waist,
    hips: data.meas_hips,
    thigh: data.meas_leg || data.meas_thigh,
    chest: data.meas_chest,
    shoulders: data.meas_shoulders,
  }) as Record<string, string | number | null | undefined>;
  const gender = String(data.gender || "male").toLowerCase();
  const formattedRegDate = formatTimestamp(regDate);

  return (
    <ExportProfileClient
      traineeName={traineeName}
      regDate={formattedRegDate}
      gender={gender}
      plan={plan}
      goal={goal}
      age={age}
      weight={weight}
      height={height}
      activity={activity}
      allergies={allergies}
      healthIssues={healthIssues}
      dislikedFood={dislikedFood}
      workoutLocation={workoutLocation}
      sleepHours={sleepHours}
      waterIntake={waterIntake}
      stressLevel={stressLevel}
      experience={experience}
      measurements={measurements}
      monthlyHistory={monthlyHistory}
      raw={data}
    />
  );
}
