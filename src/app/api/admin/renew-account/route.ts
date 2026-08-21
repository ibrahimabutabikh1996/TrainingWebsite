import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { subscriptionExtendFrom } from "@/lib/subscription";
import type { JsonRecord } from "@/types";
import { requireAdmin } from "@/lib/authGuard";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Hands out a paid month. Only the coach decides that.
 *
 * This is the approval end of the renewal flow, and until now nothing in the
 * panel called it: the trainee's request was recorded, the coach was notified,
 * and there was no button anywhere that granted the month. See
 * `PendingRenewalCard`, which is the caller. */
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

    /* The column is uuid, and Prisma raises P2007 on anything else — an
       unhandled throw that came back as the catch-all 500 below, "حدث خطأ أثناء
       تجديد الاشتراك", for a request that was simply malformed. Same check the
       profile page and the delete action already make. */
    if (typeof profileId !== "string" || !UUID_PATTERN.test(profileId)) {
      return NextResponse.json(
        { error: "معرّف المشترك غير صالح" },
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

    /* This is the approval. Whatever the trainee submitted through the intake
       form was a request — /api/submit-form records `renewal_pending` and grants
       nothing — and clearing the flags here is what closes it. Cleared
       unconditionally, because the coach may also renew an account that never
       filed a request, and a stale flag would leave the panel showing a pending
       review for a month already granted. */
    delete data.renewal_pending;
    delete data.renewal_requested_at;
    delete data.renewal_requested_month;

    /* Added to what is already there, not measured from today.
       `subscriptionEndFrom()` with no argument meant a trainee renewing on day
       20 of 30 lost the ten days they had already paid for. See
       `subscriptionExtendFrom`. */
    await prisma.profiles.update({
      where: { id: profileId },
      data: {
        data: data,
        subscription_ends_at: subscriptionExtendFrom(profile.subscription_ends_at),
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
