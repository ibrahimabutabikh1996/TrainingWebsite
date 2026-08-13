import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { JsonRecord } from "@/types";

export async function POST(request: Request) {
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

    let data = profile.data as JsonRecord;
    if (typeof data === "string") {
      data = JSON.parse(data);
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
