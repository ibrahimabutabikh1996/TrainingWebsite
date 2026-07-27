import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { subscriptionEndFrom } from "@/lib/subscription";
import type { JsonRecord } from "@/types";

export async function POST(request: Request) {
  try {
    const { profileId, isSuspended } = await request.json();

    if (!profileId) {
      return NextResponse.json(
        { error: "المعرف غير متوفر" },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: "لم يتم العثور على المشترك" },
        { status: 404 }
      );
    }

    let data = profile.data as JsonRecord || {};
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { data = {}; }
    }

    const suspended = Boolean(isSuspended);

    /* is_suspended is now a real column — it gates login, so it needs a type
       and a default rather than living in an unvalidated blob. The JSON copy is
       kept in step for any reader not yet migrated. */
    data.is_suspended = suspended;

    /* The subscription clock starts on FIRST activation only. Re-activating an
       account that was suspended mid-period must not hand out extra days, so
       both fields are written only when they are still unset. */
    const firstActivation = !suspended && !profile.subscription_ends_at;
    if (!suspended && !data.activation_date) {
      data.activation_date = new Date().toISOString();
    }

    await prisma.profiles.update({
      where: { id: profileId },
      data: {
        data,
        is_suspended: suspended,
        ...(firstActivation ? { subscription_ends_at: subscriptionEndFrom() } : {}),
      },
    });

    return NextResponse.json({ success: true, is_suspended: isSuspended });
  } catch (error) {
    console.error("Suspend account error:", error);
    return NextResponse.json(
      { error: "حدث خطأ داخلي في الخادم" },
      { status: 500 }
    );
  }
}
