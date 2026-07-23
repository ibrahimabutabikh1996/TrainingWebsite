import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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

    // Prepare response data mapped to UI needs
    const responseData = {
      id: profile.id,
      fullname: data.fullname || profile.username,
      plan: data.plan || "غير محدد",
      age: data.age || "غير محدد",
      weight: data.weight || "غير محدد",
      height: data.height || "غير محدد",
      activity: data.activity || "غير محدد",
      goal: data.goal || "غير محدد",
      gender: data.gender || "male",
      dietCalories: data.dietCalories || 2000,
      allergies: data.allergies || "لا يوجد",
      meals: courseData?.meals || {
        breakfast: { time: "غير محدد", desc: "انتظر إضافة الجدول" },
        lunch: { time: "غير محدد", desc: "انتظر إضافة الجدول" },
        dinner: { time: "غير محدد", desc: "انتظر إضافة الجدول" },
      },
      workouts: courseData?.workouts || [],
      measurements: data.measurements || null,
      photos: data.photos || null,
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
