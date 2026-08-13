import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSubscriptionExpired } from "@/lib/subscription";
import { asMeals, planTotals, type DietPlan } from "@/types/diet";
import { toISODate } from "@/lib/trainingCycle";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "الرقم التعريفي مطلوب (userId)" },
        { status: 400 }
      );
    }

    // 1. Fetch the user's profile
    const profile = await prisma.profiles.findFirst({
      where: { user_id: userId },
      include: {
        courses: true, // Fetch the assigned course/plan
      },
      orderBy: { created_at: 'desc' }
    });

    if (!profile) {
      return NextResponse.json(
        { error: "لم يتم العثور على ملف الكابتن لهذا المستخدم" },
        { status: 404 }
      );
    }

    const data = typeof profile.data === "string" ? JSON.parse(profile.data) : (profile.data || {});
    
    // Parse the course days data if available
    let courseData = null;
    if (profile.courses) {
      courseData = typeof profile.courses.days_data === "string" 
        ? JSON.parse(profile.courses.days_data) 
        : (profile.courses.days_data || null);
    }

    /* The diets the coach prescribed, newest slot last. Read through asMeals so
       a row written before a slot existed still comes back with all five, and
       so a hand-edited jsonb blob cannot reach the trainee's screen malformed. */
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

    /* Single stored end date, shared with the admin view. This used to measure
       from accounts.created_at and ignore activation_date, while the coach's
       panel measured from activation_date — so the two could disagree about
       whether the very same subscription had expired. */
    const isExpired = isSubscriptionExpired(profile.subscription_ends_at);

    /* Calculate completed training cycles and collect all workout dates associated with the trainee */
    let completedCycles = 0;
    let workoutDates: string[] = [];
    try {
      const allCycles = await prisma.training_cycles.findMany({
        where: { profile_id: profile.id },
        select: {
          days_count: true,
          completed_at: true,
          training_sessions: {
            select: { performed_on: true },
          },
        },
      });
      const datesSet = new Set<string>();
      allCycles.forEach((c) => {
        c.training_sessions.forEach((s) => {
          if (s.performed_on !== null) {
            datesSet.add(toISODate(s.performed_on));
          }
        });
      });
      const allLogs = await prisma.workout_logs.findMany({
        where: { profile_id: profile.id },
        select: { session_date: true },
      });
      allLogs.forEach((l) => {
        if (l.session_date !== null && l.session_date !== undefined) {
          datesSet.add(toISODate(l.session_date));
        }
      });
      workoutDates = Array.from(datesSet);

      // Ensure only truly finished cycles (with completed_at set and all sessions performed) are counted
      completedCycles = allCycles.filter((c) => {
        const doneSessions = c.training_sessions.filter((s) => s.performed_on !== null).length;
        return c.completed_at !== null && doneSessions >= c.days_count && c.days_count > 0;
      }).length;
    } catch (err) {
      console.error("Failed to count completed training cycles or fetch workout dates:", err);
    }

    // Calculate actual prescribed calories from the coach's diet plan if available
    let actualCalories = data.dietCalories || null;
    if (dietPlans && dietPlans.length > 0) {
      const calculated = Math.round(planTotals(dietPlans[0].meals).calories);
      if (calculated > 0) actualCalories = calculated;
    }

    // Prepare response data mapped to UI needs
    const responseData = {
      id: profile.id,
      fullname: data.fullname || profile.username,
      plan: data.plan || "غير محدد",
      age: data.age || "غير محدد",
      weight: data.weight || "غير محدد",
      height: data.height || "غير محدد",
      activity: data.activity || "غير محدد",
      goal: data.sub_goal || data.goal || "غير محدد",
      gender: data.gender || "male",
      dietCalories: actualCalories,
      allergies: data.allergies || "لا يوجد",
      meals: courseData?.meals || {
        breakfast: { time: "غير محدد", desc: "انتظر إضافة الجدول" },
        lunch: { time: "غير محدد", desc: "انتظر إضافة الجدول" },
        dinner: { time: "غير محدد", desc: "انتظر إضافة الجدول" },
      },
      dietPlans,
      workouts: Array.isArray(courseData) ? courseData : (courseData?.workouts || []),
      measurements: data.measurements || null,
      photos: data.photos || null,
      raw_answers: data, // Return all raw answers for the dashboard
      isExpired: isExpired,
      created_at: profile.created_at ? profile.created_at.toISOString() : undefined,
      activation_date: data.activation_date || (profile.created_at ? profile.created_at.toISOString() : null),
      subscription_ends_at: profile.subscription_ends_at ? profile.subscription_ends_at.toISOString() : null,
      completedWorkoutDays: completedCycles,
      completedCycles: completedCycles,
      workoutDates: workoutDates,
    };

    return NextResponse.json({
      success: true,
      profile: responseData,
    });

  } catch (error: unknown) {
    console.error("Profile API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب الملف الشخصي" },
      { status: 500 }
    );
  }
}
