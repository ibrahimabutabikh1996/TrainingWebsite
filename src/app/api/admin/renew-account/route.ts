import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { subscriptionEndFrom } from "@/lib/subscription";
import type { JsonRecord } from "@/types";
import { requireAdmin } from "@/lib/authGuard";

/* Hands out a paid month. Only the coach decides that. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

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

    /* `|| {}` to match /api/admin/suspend-account. Without it a profile whose
       `data` is null — which the column permits — threw a TypeError on the very
       next line and the coach saw "حدث خطأ أثناء تجديد الاشتراك" for a renewal
       that had nothing wrong with it. */
    let data = (profile.data as JsonRecord) || {};
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }

    /* Read as a list rather than assumed to be one. The old test was
       `if (!data.renewals)`, which passes for any non-empty value — a string, an
       object, anything a hand-edited or older row happens to hold. `.length` on
       those is undefined, so the label came out "الشهر NaN", and `.push` threw. */
    const renewals = Array.isArray(data.renewals) ? data.renewals : [];

    const nextMonthNumber = renewals.length + 2; // Month 1 is the creation date
    const newRenewal = {
      date: new Date().toISOString(),
      label: `الشهر ${nextMonthNumber}`,
    };

    renewals.push(newRenewal);
    data.renewals = renewals;

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
