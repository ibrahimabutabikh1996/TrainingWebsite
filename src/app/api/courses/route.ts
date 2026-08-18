import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authGuard";

/* Returns every course there is, the same rows as /api/admin/courses — so it
   is guarded the same way, whatever its path suggests. A trainee's own course
   reaches them through /api/profile, which returns just theirs. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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
