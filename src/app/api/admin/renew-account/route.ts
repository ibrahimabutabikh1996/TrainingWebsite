import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { subscriptionEndFrom } from "@/lib/subscription";
import type { JsonRecord } from "@/types";

export async function POST(request: Request) {
  try {
    const { profileId } = await request.json();

    if (!profileId) {
      return NextResponse.json(
        { error: "معرف المشترك مطلوب" },
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

    let data = profile.data as JsonRecord;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }

    if (!data.renewals) {
      data.renewals = [];
    }

    const nextMonthNumber = data.renewals.length + 2; // Month 1 is the creation date
    const newRenewal = {
      date: new Date().toISOString(),
      label: `الشهر ${nextMonthNumber}`,
    };

    data.renewals.push(newRenewal);

    /* A renewal restarts the period. Storing the end date here means readers
       no longer have to dig the last element out of data.renewals. */
    await prisma.profiles.update({
      where: { id: profileId },
      data: {
        data: data,
        subscription_ends_at: subscriptionEndFrom(),
      },
    });

    return NextResponse.json({
      success: true,
      renewal: newRenewal,
    });
  } catch (error: unknown) {
    console.error("Renew API Error:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تجديد الاشتراك" },
      { status: 500 }
    );
  }
}
