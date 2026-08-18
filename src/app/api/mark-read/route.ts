import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/authGuard";
import type { JsonRecord } from "@/types";

/* Clears the "new subscriber" flag the panel's list draws. Only the coach sees
   that list, so only the coach can have read it. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: "معرّف الملف مفقود" }, { status: 400 });
    }

    const profile = await prisma.profiles.findUnique({
      where: { id }
    });

    if (!profile) {
      return NextResponse.json({ error: "لم يتم العثور على الملف" }, { status: 404 });
    }

    /* `|| {}` and a guarded parse, matching the other routes that read this
       column. Neither was here: a null `data` threw on the next line, and a
       string that is not valid JSON threw inside `JSON.parse` — both surfacing
       as a 500 for the act of marking a subscriber as read. */
    let data = (profile.data as JsonRecord) || {};
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { data = {}; }
    }


    if (data.is_new) {
      data.is_new = false;
      await prisma.profiles.update({
        where: { id },
        data: {
          data
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json({ error: "حدث خطأ في الخادم" }, { status: 500 });
  }
}
