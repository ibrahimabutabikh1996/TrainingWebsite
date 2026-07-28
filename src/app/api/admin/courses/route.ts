import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const courses = await prisma.courses.findMany({
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ courses });
  } catch (error: unknown) {
    console.error("Admin Courses Error:", error);
    return NextResponse.json({ error: "Failed to fetch courses" }, { status: 500 });
  }
}
