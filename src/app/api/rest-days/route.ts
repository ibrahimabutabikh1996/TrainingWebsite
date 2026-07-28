import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { subscriptionWindow } from "@/lib/subscription";
import { subscriptionBlock } from "@/lib/trainingCycle";
import { fromISODate, isISODate, toISODate } from "@/lib/trainingDates";

export const dynamic = "force-dynamic";

const isValidUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Rest days are the trainee's own. Training days are not fixed, so neither are
 * the days off between them: the trainee names theirs out of the days their
 * subscription covers, and a rest day counts towards no cycle — it is a record
 * of a day taken off, not a workout.
 */
async function windowFor(profileId: string) {
  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { id: true, subscription_ends_at: true },
  });
  return profile ? { profile, window: subscriptionWindow(profile.subscription_ends_at) } : null;
}

/**
 * GET /api/rest-days?profileId=…
 *   → the days marked as rest, newest first, plus the subscription period they
 *     may be placed in.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId || !isValidUUID(profileId)) {
      return NextResponse.json({ error: "معرّف المشترك غير صالح" }, { status: 400 });
    }

    const found = await windowFor(profileId);
    if (!found) {
      return NextResponse.json({ error: "المشترك غير موجود" }, { status: 404 });
    }

    const days = await prisma.rest_days.findMany({
      where: { profile_id: profileId },
      orderBy: { rest_on: "desc" },
      select: { id: true, rest_on: true, note: true },
    });

    return NextResponse.json({
      success: true,
      window: found.window,
      days: days.map((d) => ({ id: d.id, rest_on: toISODate(d.rest_on), note: d.note })),
    });
  } catch (error) {
    console.error("Rest days GET error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي في الخادم" }, { status: 500 });
  }
}

/**
 * POST /api/rest-days — mark a day as rest.
 *
 * The day has to fall inside the subscription, and it cannot be a day the trainee
 * has already recorded a workout on: one day is either trained or rested.
 */
export async function POST(request: Request) {
  try {
    const { profileId, restOn, note } = await request.json();

    if (!profileId || !isValidUUID(profileId)) {
      return NextResponse.json({ error: "معرّف المشترك غير صالح" }, { status: 400 });
    }
    if (!isISODate(restOn)) {
      return NextResponse.json({ error: "التاريخ غير صالح" }, { status: 400 });
    }

    const found = await windowFor(profileId);
    if (!found) {
      return NextResponse.json({ error: "المشترك غير موجود" }, { status: 404 });
    }

    /* Same rule as the workout log: a lapsed or suspended trainee cannot write. */
    const blocked = await subscriptionBlock(profileId);
    if (blocked) {
      return NextResponse.json({ error: blocked.error }, { status: blocked.status });
    }

    /* Trainees whose subscription was never activated have no month to sit
       inside yet; the day is accepted rather than blocking them on the coach. */
    const { window } = found;
    if (window && (restOn < window.start || restOn > window.end)) {
      return NextResponse.json(
        { error: "اختر يوماً داخل مدة اشتراكك الحالية" },
        { status: 400 }
      );
    }

    const trained = await prisma.training_sessions.count({
      where: {
        performed_on: fromISODate(restOn),
        training_cycles: { profile_id: profileId },
      },
    });
    if (trained > 0) {
      return NextResponse.json(
        { error: "هذا اليوم مُسجَّل كيوم تمرين — لا يمكن اعتباره راحة" },
        { status: 409 }
      );
    }

    const day = await prisma.rest_days.upsert({
      where: { profile_id_rest_on: { profile_id: profileId, rest_on: fromISODate(restOn) } },
      create: {
        profile_id: profileId,
        rest_on: fromISODate(restOn),
        note: note ? String(note).slice(0, 500) : null,
      },
      update: { note: note ? String(note).slice(0, 500) : null },
      select: { id: true, rest_on: true, note: true },
    });

    return NextResponse.json({
      success: true,
      day: { id: day.id, rest_on: toISODate(day.rest_on), note: day.note },
    });
  } catch (error) {
    console.error("Rest days POST error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي في الخادم" }, { status: 500 });
  }
}

/** DELETE /api/rest-days?profileId=…&restOn=YYYY-MM-DD — take the marking back off. */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const restOn = searchParams.get("restOn");

    if (!profileId || !isValidUUID(profileId)) {
      return NextResponse.json({ error: "معرّف المشترك غير صالح" }, { status: 400 });
    }
    if (!isISODate(restOn)) {
      return NextResponse.json({ error: "التاريخ غير صالح" }, { status: 400 });
    }

    /* deleteMany rather than delete: removing a day that is already not a rest
       day is the state the caller asked for, not an error. */
    await prisma.rest_days.deleteMany({
      where: { profile_id: profileId, rest_on: fromISODate(restOn) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rest days DELETE error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي في الخادم" }, { status: 500 });
  }
}
