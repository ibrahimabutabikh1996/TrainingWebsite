import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/authGuard";
import { isSubscriptionExpired } from "@/lib/subscription";
import { asMeals, planTotals, type DietPlan } from "@/types/diet";
import { toISODate } from "@/lib/trainingCycle";

/**
 * GET /api/profile → the signed-in trainee's own profile.
 *
 * Whose profile this is comes from the session cookie, not from the query
 * string. It used to come from `?userId=`, which the dashboard read out of
 * `localStorage` — so the answer to "whose data may I have?" was whatever the
 * browser last wrote there. Editing that one value in a console returned
 * somebody else's intake answers, health notes, measurements and photos.
 *
 * The coach may still name a `userId` explicitly, because the panel is built on
 * reading other people's files; nobody else's is even looked at.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("userId");
    const userId =
      auth.session.isAdmin && requested ? requested : auth.session.userId;

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
        { error: "لم يتم العثور على بيانات المتدرب" },
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

    // Calculate actual prescribed calories from the coach's diet plan if available
    let actualCalories = data.dietCalories || null;
    if (dietPlans && dietPlans.length > 0) {
      const calculated = Math.round(planTotals(dietPlans[0].meals).calories);
      if (calculated > 0) actualCalories = calculated;
    }

    // Build basic monthly history timeline
    const monthNamesAr = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
    const monthlyHistory = [];
    const regDate = data.activation_date ? new Date(data.activation_date) : (profile.created_at ? new Date(profile.created_at) : new Date());
    const now = new Date();
    const diffMs = now.getTime() - regDate.getTime();
    const totalDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const totalMonths = Math.max(1, Math.floor(totalDays / 30) + 1);

    const deletedMonths = Array.isArray(data.deleted_months) ? data.deleted_months : [];
    const deleteAllHistory = Boolean(data.delete_all_history);

    for (let m = 1; m <= totalMonths; m++) {
      if (deleteAllHistory || deletedMonths.includes(m)) {
        continue;
      }
      const start = new Date(regDate.getTime() + (m - 1) * 30 * 86400000);
      const end = new Date(regDate.getTime() + m * 30 * 86400000);
      const isCurrent = m === totalMonths;
      
      const arabicIdx = m - 1;
      const monthTitle = arabicIdx < monthNamesAr.length ? `الشهر ${monthNamesAr[arabicIdx]}` : `الشهر رقم ${m}`;

      monthlyHistory.push({
        monthNumber: m,
        monthName: monthTitle,
        startDate: toISODate(start),
        endDate: toISODate(end),
        status: isCurrent ? "current" : "completed",
        workout: null,
        diet: null,
      });
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
      weightLogs: data.weightLogs || [],
      raw_answers: data, // Return all raw answers for the dashboard
      isExpired: isExpired,
      created_at: profile.created_at ? profile.created_at.toISOString() : undefined,
      activation_date: data.activation_date || (profile.created_at ? profile.created_at.toISOString() : null),
      subscription_ends_at: profile.subscription_ends_at ? profile.subscription_ends_at.toISOString() : null,
      monthlyHistory: monthlyHistory,
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
