import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownWorkScope, requireAdmin } from "@/lib/authGuard";

export const runtime = "nodejs";

/* Every course the coach has written, including the ones assigned to named
   trainees. `/api/courses` is the trainee-facing view; this one is the panel's. */
export async function GET() {
  const auth = await requireAdmin(["courses.view", "subscribers.view"]);
  if (!auth.ok) return auth.response;

  try {
    const courses = await prisma.courses.findMany({
      /* A staff member gets only the courses they made. */
      where: ownWorkScope(auth.session),
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ courses });
  } catch (error: unknown) {
    console.error("Admin Courses Error:", error);
    return NextResponse.json({ error: "تعذّر جلب الكورسات" }, { status: 500 });
  }
}
