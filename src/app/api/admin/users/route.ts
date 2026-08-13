import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ profiles });
  } catch (error: unknown) {
    console.error("Admin Users Error:", error);
    return NextResponse.json({ error: "تعذّر جلب المستخدمين" }, { status: 500 });
  }
}
