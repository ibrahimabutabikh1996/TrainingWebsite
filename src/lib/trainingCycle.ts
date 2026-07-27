/* There is no week here.

   A trainee's unit of progress is a *cycle*: `days_count` workouts, as many as
   they said at registration they could commit to. It closes the moment that many
   workouts carry a date, and the next one opens. Nothing else starts or ends it —
   not a Saturday, not a month boundary, not the calendar at all.

   Which days those workouts land on is entirely the trainee's own: they may be
   postponed, they need not run consecutively, and the trainee names the day and
   the date when they record each one. Someone who meant to train Sunday, Monday
   and Tuesday but trained Monday, Tuesday and Wednesday has finished a cycle all
   the same; a fourth workout in those same seven days is simply the first workout
   of the cycle after it.

   Cycles are numbered per trainee, as a running count that is never reset, and
   never rewritten: a closed cycle stays in the history exactly as it was filled
   in. The next one is created lazily, the first time anyone opens the trainee's
   plan after the previous closed — no scheduled job to run or monitor. */

import { prisma } from "@/lib/db";
import { asDays } from "@/types/admin";
import { todayISODate } from "@/lib/trainingDates";
import { isSubscriptionExpired } from "@/lib/subscription";
import { MAX_CYCLE_DAYS, MIN_CYCLE_DAYS, workoutDaysOf } from "@/lib/workoutDays";

export { toISODate, fromISODate } from "@/lib/trainingDates";

/** Guards the retry in `ensureCurrentCycle` against spinning on a persistent conflict. */
const MAX_CREATE_ATTEMPTS = 3;

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

export interface CurrentCycle {
  id: string;
  cycle_number: number;
  days_count: number;
  course_id: string | null;
}

/**
 * Whether the trainee may still write to their log.
 *
 * The dashboard already hides the plan once a subscription lapses, but that is a
 * screen hiding a button, not a rule. The rule lives here, so calling the service
 * directly cannot get round it.
 */
export type WriteBlock = { status: 403; error: string } | null;

export async function subscriptionBlock(profileId: string): Promise<WriteBlock> {
  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { is_suspended: true, subscription_ends_at: true },
  });
  if (!profile) return null; /* Absent profiles are the caller's 404, not a 403. */
  if (profile.is_suspended) {
    return { status: 403, error: "الحساب متوقف — راجع الكابتن" };
  }
  if (isSubscriptionExpired(profile.subscription_ends_at)) {
    return { status: 403, error: "انتهت مدة اشتراكك — جدّد الاشتراك لمتابعة التسجيل" };
  }
  return null;
}

/**
 * Returns the trainee's open cycle, starting one (with its empty sessions) if the
 * previous cycle has just been completed or if this is their first.
 *
 * The workout count comes from what the trainee said they could commit to when
 * they registered, and is copied onto the cycle, so answering differently on a
 * renewal never reshapes a cycle they have already worked through. Trainees who
 * registered before that question existed fall back to the length of the course.
 *
 * Returns null when the trainee has no course assigned yet.
 */
export async function ensureCurrentCycle(
  profileId: string,
  attempt = 0
): Promise<CurrentCycle | null> {
  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      data: true,
      current_course_id: true,
      courses: { select: { id: true, days_data: true } },
    },
  });
  if (!profile) return null;

  const planDays = asDays(profile.courses?.days_data);
  if (!profile.current_course_id || planDays.length === 0) return null;

  const daysCount =
    workoutDaysOf(profile.data) ??
    Math.min(MAX_CYCLE_DAYS, Math.max(MIN_CYCLE_DAYS, planDays.length));

  /* At most one cycle is open per trainee — the database enforces it. */
  const open = await prisma.training_cycles.findFirst({
    where: { profile_id: profileId, completed_at: null },
    orderBy: { cycle_number: "asc" },
    select: {
      id: true,
      cycle_number: true,
      days_count: true,
      course_id: true,
      plan_data: true,
      _count: { select: { training_sessions: true } },
    },
  });

  if (open) {
    /* If the trainee raised the number of days they can commit to, top up the
       missing session rows rather than leaving them unable to record those
       workouts. Existing days and their logs are untouched, and days are never
       removed from a live cycle — the trainee finishes the cycle they started. */
    if (open._count.training_sessions < daysCount) {
      const existing = open._count.training_sessions;
      /* The frozen days stay exactly as they were; only the days being added now
         are filled in from the course as it stands. */
      const snapshot = asDays(open.plan_data);
      const grownPlan =
        snapshot.length >= daysCount ? snapshot : [...snapshot, ...planDays.slice(snapshot.length)];
      await prisma.$transaction([
        prisma.training_sessions.createMany({
          data: Array.from({ length: daysCount - existing }, (_, i) => ({
            cycle_id: open.id,
            day_number: existing + i + 1,
          })),
          skipDuplicates: true,
        }),
        prisma.training_cycles.update({
          where: { id: open.id },
          data: { days_count: daysCount, plan_data: grownPlan },
        }),
      ]);
      return {
        id: open.id,
        cycle_number: open.cycle_number,
        days_count: daysCount,
        course_id: open.course_id,
      };
    }

    return {
      id: open.id,
      cycle_number: open.cycle_number,
      days_count: open.days_count,
      course_id: open.course_id,
    };
  }

  const last = await prisma.training_cycles.findFirst({
    where: { profile_id: profileId },
    orderBy: { cycle_number: "desc" },
    select: { cycle_number: true },
  });

  try {
    return await prisma.training_cycles.create({
      data: {
        profile_id: profileId,
        course_id: profile.current_course_id,
        cycle_number: (last?.cycle_number ?? 0) + 1,
        days_count: daysCount,
        /* The plan is copied, not pointed at: the cycle is performed against this
           copy, so reassigning or editing the course afterwards cannot re-label
           weights already recorded against it. A new plan takes effect from the
           next cycle. */
        plan_data: planDays,
        training_sessions: {
          create: Array.from({ length: daysCount }, (_, i) => ({ day_number: i + 1 })),
        },
      },
      select: { id: true, cycle_number: true, days_count: true, course_id: true },
    });
  } catch (e) {
    /* Two tabs opening the plan at once both try to start the same cycle; the
       unique indexes let exactly one through. Read back whichever won. */
    if (isUniqueViolation(e) && attempt < MAX_CREATE_ATTEMPTS) {
      return ensureCurrentCycle(profileId, attempt + 1);
    }
    throw e;
  }
}

export interface SessionCycle {
  id: string;
  profile_id: string;
  cycle_number: number;
  days_count: number;
  completed_at: Date | null;
}

export type SessionAccess =
  | {
      ok: true;
      session: { id: string; day_number: number; performed_on: Date | null; notes: string | null };
      cycle: SessionCycle;
      /** The cycle started on top of a closed one, still empty — removed if that cycle re-opens. */
      followingCycleId: string | null;
    }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Loads a session and decides whether the trainee may still write to it.
 *
 * The open cycle is always writable. A closed cycle is history — with one
 * exception: a cycle closes the instant its last workout is recorded, which
 * would make a mistyped date unfixable. So the trainee may step back into the
 * cycle they just finished for as long as the next one is still untouched —
 * nothing recorded in it, nothing logged against it.
 */
export async function resolveSessionAccess(
  sessionId: string,
  profileId?: string
): Promise<SessionAccess> {
  const session = await prisma.training_sessions.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      day_number: true,
      performed_on: true,
      notes: true,
      training_cycles: {
        select: {
          id: true,
          profile_id: true,
          cycle_number: true,
          days_count: true,
          completed_at: true,
        },
      },
    },
  });

  if (!session || (profileId && session.training_cycles.profile_id !== profileId)) {
    return { ok: false, status: 404, error: "التمرين غير موجود" };
  }

  const cycle = session.training_cycles;
  const row = {
    id: session.id,
    day_number: session.day_number,
    performed_on: session.performed_on,
    notes: session.notes,
  };

  if (cycle.completed_at === null) {
    return { ok: true, session: row, cycle, followingCycleId: null };
  }

  const following = await prisma.training_cycles.findFirst({
    where: { profile_id: cycle.profile_id, cycle_number: { gt: cycle.cycle_number } },
    orderBy: { cycle_number: "asc" },
    select: { id: true },
  });

  if (following) {
    const touched = await prisma.training_sessions.count({
      where: {
        cycle_id: following.id,
        OR: [{ performed_on: { not: null } }, { workout_logs: { some: {} } }],
      },
    });
    if (touched > 0) {
      return {
        ok: false,
        status: 409,
        error: "لا يمكن تعديل دورة مكتملة — الدورات السابقة محفوظة كسجل",
      };
    }
  }

  return { ok: true, session: row, cycle, followingCycleId: following?.id ?? null };
}

export interface CompletionState {
  /** Workouts recorded in the cycle. */
  done: number;
  completed: boolean;
  /** True when this call is what opened or closed the cycle. */
  changed: boolean;
}

/**
 * Brings a cycle's `completed_at` in line with how many of its workouts carry a
 * date. Call it after any change to a session's date — that count is the only
 * thing that ends a cycle.
 */
export async function syncCycleCompletion(
  cycle: { id: string; days_count: number; completed_at: Date | null },
  followingCycleId: string | null
): Promise<CompletionState> {
  const done = await prisma.training_sessions.count({
    where: { cycle_id: cycle.id, performed_on: { not: null } },
  });

  const shouldBeComplete = done >= cycle.days_count;
  const wasComplete = cycle.completed_at !== null;
  if (shouldBeComplete === wasComplete) {
    return { done, completed: wasComplete, changed: false };
  }

  if (shouldBeComplete) {
    await prisma.training_cycles.update({
      where: { id: cycle.id },
      data: { completed_at: new Date() },
    });
  } else {
    /* Re-opening: the cycle that was started on top of this one has to go first —
       a trainee is only ever inside one cycle. It holds nothing but empty session
       rows (`resolveSessionAccess` refused the edit otherwise), and it is created
       again, with the same number, on the next read. */
    await prisma.$transaction([
      ...(followingCycleId
        ? [prisma.training_cycles.delete({ where: { id: followingCycleId } })]
        : []),
      prisma.training_cycles.update({ where: { id: cycle.id }, data: { completed_at: null } }),
    ]);
  }

  return { done, completed: shouldBeComplete, changed: true };
}

/**
 * Re-dates the sets already logged against a session.
 *
 * Weights are typed while training; the date the session is filed under is chosen
 * separately, possibly afterwards. The logs follow that choice, otherwise the
 * coach's progression table would column them under the day they were typed.
 *
 * Sets logged across two sittings before a date was chosen would collapse onto
 * one date and collide on `uq_workout_logs_entry`, so the older duplicate of each
 * (exercise, set) is dropped first — the later entry is the correction.
 */
export async function redateSessionLogs(
  profileId: string,
  sessionId: string,
  dateISO: string
): Promise<void> {
  await prisma.$transaction([
    prisma.$executeRaw`
      DELETE FROM public.workout_logs a
      USING public.workout_logs b
      WHERE a.profile_id = ${profileId}::uuid
        AND b.profile_id = ${profileId}::uuid
        AND a.day_id = ${sessionId}
        AND b.day_id = ${sessionId}
        AND a.exercise_id = b.exercise_id
        AND a.set_index = b.set_index
        AND (a.logged_at, a.id) < (b.logged_at, b.id)`,
    prisma.$executeRaw`
      UPDATE public.workout_logs
      SET session_date = ${dateISO}::date
      WHERE profile_id = ${profileId}::uuid AND day_id = ${sessionId}`,
  ]);
}

/**
 * The date a set should be filed under: the day the trainee said the session
 * happened, falling back to today while they have not said yet.
 */
export function sessionDateFor(performedOn: Date | null): Date {
  return performedOn ?? new Date(todayISODate());
}
