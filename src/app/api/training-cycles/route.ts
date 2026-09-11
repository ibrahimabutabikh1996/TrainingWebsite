import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProfileAccess, requireUser, sessionOwnsProfile } from "@/lib/authGuard";
import {
  ensureCurrentCycle,
  redateSessionLogs,
  resolveSessionAccess,
  syncCycleCompletion,
  toISODate,
} from "@/lib/trainingCycle";
import { isRecordableDate, fromISODate, todayISODate } from "@/lib/trainingDates";
import { subscriptionBlock } from "@/lib/trainingCycle";
import { asDays } from "@/types/admin";

export const dynamic = "force-dynamic";

const isValidUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * GET /api/training-cycles?profileId=…
 *   → every cycle the trainee has been through, oldest first, with the open one
 *     last. The open cycle is created on the fly if the previous was just
 *     completed.
 *
 * GET /api/training-cycles?profileId=…&view=dates
 *   → only the days already recorded as trained: `{ date, day_number,
 *     cycle_number }` each. For the calendar, which marks days and nothing else.
 *
 * A cycle is a count of workouts, never a span of dates: `done` out of
 * `days_count` is all that drives it, and it ends the moment those two meet.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");

    if (!profileId || !isValidUUID(profileId)) {
      return NextResponse.json({ error: "معرّف المشترك غير صالح" }, { status: 400 });
    }

    const auth = await requireProfileAccess(profileId);
    if (!auth.ok) return auth.response;

    /* The dashboard's calendar needs one thing: which days were trained, and
       which day of the plan each was. Answered on its own rather than out of the
       full read below, which also carries every cycle's frozen plan and every
       weight ever recorded — a hundred times the bytes for a grid of marks, paid
       on every visit to the home tab.

       Deliberately before `ensureCurrentCycle`: looking at a calendar is a read,
       and must not open a training cycle as a side effect. */
    if (searchParams.get("view") === "dates") {
      const trained = await prisma.training_sessions.findMany({
        where: {
          performed_on: { not: null },
          training_cycles: { profile_id: profileId },
        },
        orderBy: { performed_on: "asc" },
        select: {
          day_number: true,
          performed_on: true,
          training_cycles: { select: { cycle_number: true } },
        },
      });

      return NextResponse.json({
        success: true,
        /* `flatMap` rather than a non-null assertion on `performed_on`: the query
           already excludes the nulls, and this says so in a way the types agree
           with. */
        days: trained.flatMap((s) =>
          s.performed_on
            ? [
                {
                  date: toISODate(s.performed_on),
                  day_number: s.day_number,
                  cycle_number: s.training_cycles.cycle_number,
                },
              ]
            : []
        ),
      });
    }

    const current = await ensureCurrentCycle(profileId);

    /* Only for cycles that predate `plan_data`; every new cycle carries its own. */
    const fallback = await prisma.profiles.findUnique({
      where: { id: profileId },
      select: { courses: { select: { days_data: true } } },
    });
    const fallbackPlan = fallback?.courses?.days_data ?? null;

    const cycles = await prisma.training_cycles.findMany({
      where: { profile_id: profileId },
      orderBy: { cycle_number: "asc" },
      select: {
        id: true,
        cycle_number: true,
        days_count: true,
        completed_at: true,
        plan_data: true,
        training_sessions: {
          orderBy: { day_number: "asc" },
          select: {
            id: true,
            day_number: true,
            performed_on: true,
            notes: true,
            workout_logs: {
              orderBy: [{ exercise_name: "asc" }, { set_index: "asc" }],
              select: {
                id: true,
                exercise_id: true,
                exercise_name: true,
                set_index: true,
                reps: true,
                weight: true,
              },
            },
          },
        },
      },
    });

    /* Mirrors `resolveSessionAccess`: the open cycle is writable, and so is the
       one just closed while the cycle after it is still untouched — otherwise a
       date mistyped on the last workout of a cycle could never be corrected. */
    const lastIndex = cycles.length - 1;
    const lastUntouched =
      lastIndex >= 0 &&
      cycles[lastIndex].training_sessions.every(
        (s) => s.performed_on === null && s.workout_logs.length === 0
      );

    return NextResponse.json({
      success: true,
      currentCycleId: current?.id ?? null,
      cycles: cycles.map((c, i) => {
        const done = c.training_sessions.filter((s) => s.performed_on !== null).length;
        const isCurrent = c.completed_at === null;
        return {
          id: c.id,
          cycle_number: c.cycle_number,
          days_count: c.days_count,
          done,
          isCurrent,
          isEditable: isCurrent || i === lastIndex || (i === lastIndex - 1 && lastUntouched),
          /* The plan this cycle was performed against, as it stood when it opened.
             Cycles from before the snapshot existed fall back to the assigned
             course, which is the best the record can offer for them. */
          plan: asDays(c.plan_data ?? fallbackPlan),
          sessions: c.training_sessions.map((s) => ({
            id: s.id,
            day_number: s.day_number,
            performed_on: s.performed_on ? toISODate(s.performed_on) : null,
            notes: s.notes,
            logs: s.workout_logs.map((l) => ({
              ...l,
              weight: l.weight === null ? null : Number(l.weight),
            })),
          })),
        };
      }),
    });
  } catch (error) {
    console.error("Training cycles GET error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي في الخادم" }, { status: 500 });
  }
}

/**
 * PATCH /api/training-cycles — record a workout's notes, or the day and date the
 * trainee says it was performed on.
 *
 * Setting that date is what marks the workout done. Once as many workouts as the
 * trainee committed to carry one, the cycle ends and the next opens on the next
 * read — so a workout beyond that count belongs to the cycle after it. Clearing
 * the date of the cycle just closed re-opens it.
 */
export async function PATCH(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { sessionId, notes, performedOn } = await request.json();

    if (!sessionId || !isValidUUID(sessionId)) {
      return NextResponse.json({ error: "معرّف التمرين غير صالح" }, { status: 400 });
    }

    const access = await resolveSessionAccess(String(sessionId));
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const { cycle, followingCycleId } = access;

    /* The profile is not named in this request — it is reached through the
       session id — so ownership is checked here, once the cycle says whose
       workout this is. Without it, any id from any trainee's log was writable. */
    if (!(await sessionOwnsProfile(auth.session, cycle.profile_id))) {
      return NextResponse.json({ error: "غير مصرح لك بهذا الإجراء" }, { status: 403 });
    }

    /* Reading history stays open; writing does not, whatever the screen allows. */
    const blocked = await subscriptionBlock(cycle.profile_id);
    if (blocked) {
      return NextResponse.json({ error: blocked.error }, { status: blocked.status });
    }

    /* The trainee picks the date, so it is checked here rather than trusted:
       a workout is recorded after it is done, and only recently. */
    let nextDate: Date | null | undefined;
    if (performedOn !== undefined) {
      if (performedOn === null || performedOn === "") {
        nextDate = null;
      } else if (isRecordableDate(performedOn, todayISODate())) {
        nextDate = fromISODate(performedOn);
      } else {
        return NextResponse.json(
          { error: "التاريخ غير صالح — اختر يوماً سبق أو يوافق اليوم" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.training_sessions.update({
      where: { id: String(sessionId) },
      data: {
        ...(notes !== undefined ? { notes: notes ? String(notes).slice(0, 2000) : null } : {}),
        ...(nextDate !== undefined ? { performed_on: nextDate } : {}),
      },
      select: { id: true, notes: true, performed_on: true },
    });

    /* Sets already typed in follow the date the trainee filed the workout under. */
    if (nextDate !== undefined && nextDate !== null) {
      await redateSessionLogs(cycle.profile_id, String(sessionId), toISODate(nextDate));
    }

    const state =
      nextDate !== undefined
        ? await syncCycleCompletion(cycle, followingCycleId)
        : {
            done: await prisma.training_sessions.count({
              where: { cycle_id: cycle.id, performed_on: { not: null } },
            }),
            completed: cycle.completed_at !== null,
            changed: false,
          };

    return NextResponse.json({
      success: true,
      session: {
        id: updated.id,
        notes: updated.notes,
        performed_on: updated.performed_on ? toISODate(updated.performed_on) : null,
      },
      cycle: {
        id: cycle.id,
        cycle_number: cycle.cycle_number,
        days_count: cycle.days_count,
        done: state.done,
        completed: state.completed,
      },
      /* True only on the change that ended the cycle, so the trainee is told once. */
      cycleCompleted: state.completed && state.changed,
    });
  } catch (error) {
    console.error("Training cycles PATCH error:", error);
    return NextResponse.json({ error: "حدث خطأ داخلي في الخادم" }, { status: 500 });
  }
}
