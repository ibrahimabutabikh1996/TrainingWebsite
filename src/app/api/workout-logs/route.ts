import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveSessionAccess, sessionDateFor, subscriptionBlock } from "@/lib/trainingCycle";
import { todayISODate } from "@/lib/trainingDates";

export const dynamic = "force-dynamic";

const MAX_WEIGHT = 1000;

const isValidUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * GET /api/workout-logs?profileId=…            → that trainee's whole history
 * GET /api/workout-logs?profileId=…&date=today → just today's entries
 *
 * Used by the trainee view to pre-fill what they already logged today, and by
 * the coach view to show progression across sessions.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    const date = searchParams.get("date");

    if (!profileId || !isValidUUID(profileId)) {
      return NextResponse.json({ error: "معرّف المشترك غير صالح" }, { status: 400 });
    }

    const logs = await prisma.workout_logs.findMany({
      where: {
        profile_id: profileId,
        ...(date === "today" ? { session_date: new Date(todayISODate()) } : {}),
      },
      orderBy: [{ session_date: "desc" }, { exercise_name: "asc" }, { set_index: "asc" }],
      select: {
        id: true,
        day_id: true,
        exercise_id: true,
        exercise_name: true,
        set_index: true,
        reps: true,
        weight: true,
        session_date: true,
        logged_at: true,
      },
    });

    return NextResponse.json({
      success: true,
      logs: logs.map((l) => ({
        ...l,
        /* Decimal doesn't survive JSON, so hand back a plain number. */
        weight: l.weight === null ? null : Number(l.weight),
        session_date: l.session_date.toISOString().slice(0, 10),
        logged_at: l.logged_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Workout logs GET error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي في الخادم" }, { status: 500 });
  }
}

/**
 * POST /api/workout-logs — record the weight used on one set.
 *
 * Upserts on (profile, day, exercise, set, session_date): correcting a number
 * the same day overwrites it, while the next session becomes a new row so the
 * history the coach reads stays intact.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { profileId, courseId, dayId, exerciseId, exerciseName, setIndex, reps, weight, sessionId } = body;

    if (!profileId || !isValidUUID(profileId)) {
      return NextResponse.json({ error: "معرّف المشترك غير صالح" }, { status: 400 });
    }
    if (!dayId || !exerciseId || !exerciseName) {
      return NextResponse.json({ error: "بيانات التمرين ناقصة" }, { status: 400 });
    }
    if (!Number.isInteger(setIndex) || setIndex < 0) {
      return NextResponse.json({ error: "رقم الجولة غير صالح" }, { status: 400 });
    }

    /* An empty field means "no weight recorded" rather than zero. */
    let parsedWeight: number | null = null;
    if (weight !== null && weight !== undefined && String(weight).trim() !== "") {
      const n = Number(weight);
      if (!Number.isFinite(n) || n < 0 || n > MAX_WEIGHT) {
        return NextResponse.json(
          { error: `الوزن يجب أن يكون رقماً بين 0 و ${MAX_WEIGHT}` },
          { status: 400 }
        );
      }
      parsedWeight = n;
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { id: true, current_course_id: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "المشترك غير موجود" }, { status: 404 });
    }

    /* A lapsed or suspended trainee cannot write, whatever the screen allows. */
    const blocked = await subscriptionBlock(profileId);
    if (blocked) {
      return NextResponse.json({ error: blocked.error }, { status: blocked.status });
    }

    /* Trust the profile's own course over anything the client sends. */
    const resolvedCourseId =
      courseId && isValidUUID(courseId) ? courseId : profile.current_course_id;

    /* Attach the set to its workout, and refuse to write into a cycle that has
       already closed — finished cycles are history, not editable.

       The set is filed under the date the trainee gave that workout, so the
       coach reads a progression by the day it was trained rather than by the day
       the number happened to be typed. Until they have given one, today stands
       in, and `redateSessionLogs` moves the rows across once they do. */
    let resolvedSessionId: string | null = null;
    let sessionDate = new Date(todayISODate());
    if (sessionId && isValidUUID(sessionId)) {
      const access = await resolveSessionAccess(String(sessionId), profileId);
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      resolvedSessionId = access.session.id;
      sessionDate = sessionDateFor(access.session.performed_on);
    }

    const log = await prisma.workout_logs.upsert({
      where: {
        profile_id_day_id_exercise_id_set_index_session_date: {
          profile_id: profileId,
          day_id: String(dayId),
          exercise_id: String(exerciseId),
          set_index: setIndex,
          session_date: sessionDate,
        },
      },
      create: {
        profile_id: profileId,
        course_id: resolvedCourseId,
        day_id: String(dayId),
        exercise_id: String(exerciseId),
        exercise_name: String(exerciseName),
        set_index: setIndex,
        reps: reps ? String(reps) : null,
        weight: parsedWeight,
        session_date: sessionDate,
        session_id: resolvedSessionId,
      },
      update: {
        weight: parsedWeight,
        reps: reps ? String(reps) : null,
        exercise_name: String(exerciseName),
        logged_at: new Date(),
        /* Backfills the link for rows written before sessions existed. */
        ...(resolvedSessionId ? { session_id: resolvedSessionId } : {}),
      },
      select: { id: true, weight: true, session_date: true },
    });

    return NextResponse.json({
      success: true,
      log: {
        id: log.id,
        weight: log.weight === null ? null : Number(log.weight),
        session_date: log.session_date.toISOString().slice(0, 10),
      },
    });
  } catch (error) {
    console.error("Workout logs POST error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي في الخادم" }, { status: 500 });
  }
}
