import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authGuard";

export const runtime = "nodejs";

export async function GET() {
  /* Every profile the site holds, in one response — intake answers, health
     notes, photos, measurements. Without this line it was the open internet's
     for the asking, and it handed out the very `profileId` values that
     /api/admin/change-password takes. */
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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
