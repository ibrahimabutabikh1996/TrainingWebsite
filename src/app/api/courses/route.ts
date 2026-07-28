import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const allCourses = await prisma.courses.findMany({
      orderBy: { created_at: 'desc' }
    });

    return NextResponse.json({
      success: true,
      courses: allCourses,
    });
  } catch (error: unknown) {
    console.error("Courses API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب الكورسات" },
      { status: 500 }
    );
  }
}
