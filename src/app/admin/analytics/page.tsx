import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import { getLandingContent } from "../cms/actions";
import { resolvePlanDisplayNames, planNameFrom, planOptions } from "@/lib/planNames";
import { PLAN_COLOUR_SLOT } from "@/lib/formLabels";
import { planTagStyle } from "@/lib/planCards";
import { SUBSCRIPTION_DAYS, daysRemaining, isSubscriptionExpired } from "@/lib/subscription";
import { DAY_MS, toISODate, formatShortDate } from "@/lib/trainingDates";
import type { JsonRecord } from "@/types";
import AnalyticsClient, { type AnalyticsData, type CountRow } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

/* Every number on this screen is read from what the site already stores —
   nothing is written, and nothing is tracked for the sake of it. Money is
   absent on purpose: no payment amount is stored anywhere to add up. */

/** How long without a recorded workout before an active trainee is listed as idle. */
const IDLE_DAYS = 14;

/* The intake blob may be stored as a JSON string on older rows — the same
   reading the subscriber list gives it. */
function readBlob(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

/** A tally, largest first, with the long tail folded into "أخرى". */
function ranked(counts: Map<string, number>, limit = 8): CountRow[] {
  const rows = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  if (rows.length <= limit) return rows;
  const rest = rows.slice(limit - 1).reduce((sum, r) => sum + r.count, 0);
  return [...rows.slice(0, limit - 1), { name: "أخرى", count: rest }];
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

/* The coach's analytics. No permission is passed to the guard, so this screen
   is the coach's alone — the same rule as the staff screen. */
export default async function AdminAnalyticsPage() {
  await requireAdminPage();

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysAgo = (n: number) => new Date(today.getTime() - n * DAY_MS);

  let data: AnalyticsData | null = null;

  try {
    const [
      profiles,
      lastWorkouts,
      recentSessions,
      completedCycles,
      completedCycles30,
      courses,
      exerciseCount,
      muscles,
      dietPlans,
      foodCategories,
      staff,
      landing,
    ] = await Promise.all([
      /* Four keys of the intake blob, picked in Postgres — the whole record
         carries every measurement and each renewal's copy of it. A row stored
         as a string comes back whole for `readBlob`, as on the subscriber list. */
      prisma.$queryRaw<
        Array<{
          id: string;
          username: string;
          created_at: Date;
          is_suspended: boolean;
          subscription_ends_at: Date | null;
          current_course_id: string | null;
          data: unknown;
        }>
      >`
        SELECT
          p.id,
          COALESCE(a.username, p.username) AS username,
          p.created_at,
          p.is_suspended,
          p.subscription_ends_at,
          p.current_course_id,
          CASE
            WHEN jsonb_typeof(p.data) = 'object' THEN jsonb_build_object(
              'fullname', p.data -> 'fullname',
              'plan', p.data -> 'plan',
              'plan_type', p.data -> 'plan_type',
              'renewal_pending', p.data -> 'renewal_pending',
              'activation_date', p.data -> 'activation_date'
            )
            ELSE p.data
          END AS data
        FROM public.profiles p
        LEFT JOIN public.accounts a ON a.id = p.user_id
      `,
      prisma.$queryRaw<Array<{ profile_id: string; last_on: Date }>>`
        SELECT c.profile_id, MAX(s.performed_on) AS last_on
        FROM public.training_sessions s
        JOIN public.training_cycles c ON c.id = s.cycle_id
        WHERE s.performed_on IS NOT NULL
        GROUP BY c.profile_id
      `,
      prisma.training_sessions.findMany({
        where: { performed_on: { gte: daysAgo(29) } },
        select: { performed_on: true, training_cycles: { select: { profile_id: true } } },
      }),
      prisma.training_cycles.count({ where: { completed_at: { not: null } } }),
      prisma.training_cycles.count({ where: { completed_at: { gte: daysAgo(29) } } }),
      prisma.courses.findMany({ select: { id: true, name: true, created_by: true } }),
      prisma.exercises.count(),
      prisma.exercises.groupBy({ by: ["target_muscle"], _count: { _all: true } }),
      prisma.diet_plans.findMany({ select: { id: true, profile_id: true, group_id: true, created_by: true } }),
      prisma.nutrition_sources.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.staff_accounts.findMany({
        orderBy: { created_at: "asc" },
        select: {
          account_id: true,
          is_suspended: true,
          accounts: { select: { username: true } },
          _count: { select: { staff_trainees: true } },
        },
      }),
      getLandingContent(),
    ]);

    const planNames = resolvePlanDisplayNames(landing?.content_ar as JsonRecord | undefined);
    const dietTrainees = new Set(dietPlans.filter((d) => d.profile_id).map((d) => d.profile_id as string));
    const lastWorkoutOf = new Map(lastWorkouts.map((r) => [r.profile_id, r.last_on]));

    /* ── Players ── */
    const players = {
      total: profiles.length,
      active: 0,
      expired: 0,
      suspended: 0,
      notActivated: 0,
      expiringSoon: 0,
      renewalPending: 0,
      noCourse: 0,
      noDiet: 0,
      joinedThisMonth: 0,
    };
    const planCounts = new Map<string, number>();
    const nameOf = new Map<string, string>();
    const idle: { id: string; name: string; days: number; lastOn: string | null }[] = [];

    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11 + i, 1));
      return { key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: `${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`, count: 0 };
    });
    const monthIndex = new Map(months.map((m, i) => [m.key, i]));

    for (const p of profiles) {
      const blob = readBlob(p.data);
      const name = (typeof blob.fullname === "string" && blob.fullname.trim()) || p.username;
      nameOf.set(p.id, name);

      const monthKey = `${p.created_at.getUTCFullYear()}-${p.created_at.getUTCMonth()}`;
      const mi = monthIndex.get(monthKey);
      if (mi !== undefined) months[mi].count += 1;
      if (p.created_at >= monthStart) players.joinedThisMonth += 1;

      if (blob.renewal_pending === true) players.renewalPending += 1;
      bump(planCounts, String(blob.plan ?? ""));

      if (p.is_suspended) {
        players.suspended += 1;
        continue;
      }
      /* No stored end date is read the way the coach's account card and the
         trainee's dashboard read it: thirty days from activation, or from
         sign-up when there is no activation date. Same rule as Overview. */
      const endsAt =
        p.subscription_ends_at ??
        new Date(new Date(typeof blob.activation_date === "string" ? blob.activation_date : p.created_at).getTime() + SUBSCRIPTION_DAYS * DAY_MS);
      if (Number.isNaN(endsAt.getTime())) {
        players.notActivated += 1;
        continue;
      }
      if (isSubscriptionExpired(endsAt, now)) {
        players.expired += 1;
        continue;
      }

      players.active += 1;
      const left = daysRemaining(endsAt, now);
      if (left !== null && left <= 7) players.expiringSoon += 1;

      /* What this trainee's package asks the coach to prepare. No answer on
         an older row means both, the way the profile screen reads it. */
      const planType = String(blob.plan_type ?? "both");
      const wantsTraining = planType !== "diet";
      const wantsDiet = planType !== "training";
      if (wantsTraining && !p.current_course_id) players.noCourse += 1;
      if (wantsDiet && !dietTrainees.has(p.id)) players.noDiet += 1;

      /* Idle: a programme to follow and nothing recorded against it for
         IDLE_DAYS. Counted from the last workout, or from when this month of
         the subscription began for someone who has never recorded one — so a
         trainee activated yesterday is not already "idle". */
      if (p.current_course_id) {
        const last = lastWorkoutOf.get(p.id) ?? null;
        const since = last ?? new Date(endsAt.getTime() - SUBSCRIPTION_DAYS * DAY_MS);
        const days = Math.floor((today.getTime() - since.getTime()) / DAY_MS);
        if (days >= IDLE_DAYS) idle.push({ id: p.id, name, days, lastOn: last ? toISODate(last) : null });
      }
    }

    /* An offer carries its plan's name, so by name alone plan1 and offer1 were
       two bars reading the same. planOptions marks the offer wherever the name
       is shared, as the subscriber filter and the intake form already do. */
    const planLabels = new Map(planOptions(planNames).map((o) => [o.value, o.label]));
    const plans = [...planCounts.entries()]
      .map(([value, count]) => {
        const slot = PLAN_COLOUR_SLOT[value];
        const color = slot ? `var(--plan-${slot})` : planTagStyle(value)?.background ?? "var(--text-muted)";
        return { name: planLabels.get(value) ?? planNameFrom(planNames, value, "غير محدد"), count, color };
      })
      .sort((a, b) => b.count - a.count);

    /* ── Training ── */
    const daily = Array.from({ length: 30 }, (_, i) => {
      const iso = toISODate(daysAgo(29 - i));
      return { iso, label: formatShortDate(iso), count: 0 };
    });
    const dayIndex = new Map(daily.map((d, i) => [d.iso, i]));
    const perTrainee = new Map<string, number>();
    let last7 = 0;
    const weekAgo = daysAgo(6);
    for (const s of recentSessions) {
      if (!s.performed_on) continue;
      const di = dayIndex.get(toISODate(s.performed_on));
      if (di !== undefined) daily[di].count += 1;
      if (s.performed_on >= weekAgo) last7 += 1;
      bump(perTrainee, s.training_cycles.profile_id);
    }
    const top = [...perTrainee.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, name: nameOf.get(id) ?? "—", count }));
    idle.sort((a, b) => b.days - a.days);

    /* ── Courses and exercises ── */
    const courseName = new Map(courses.map((c) => [c.id, c.name]));
    const courseUse = new Map<string, number>();
    for (const p of profiles) {
      if (p.current_course_id && courseName.has(p.current_course_id)) {
        bump(courseUse, courseName.get(p.current_course_id) as string);
      }
    }
    const muscleCounts = new Map<string, number>();
    for (const m of muscles) bump(muscleCounts, m.target_muscle?.trim() || "غير محدد", m._count._all);

    /* ── Diet ── */
    const templates = new Set(dietPlans.filter((d) => !d.profile_id).map((d) => d.group_id ?? d.id));
    const foodCounts = new Map<string, number>();
    for (const f of foodCategories) bump(foodCounts, f.category, f._count._all);

    /* ── Staff ── Who made what, by the creator's account id: the copied name
       would split one person in two after a rename. */
    const madeCourses = new Map<string, number>();
    for (const c of courses) bump(madeCourses, c.created_by ?? "");
    const madeDiet = new Map<string, number>();
    for (const d of dietPlans) bump(madeDiet, d.created_by ?? "");

    data = {
      players,
      monthly: months.map(({ label, count }) => ({ label, count })),
      plans,
      training: {
        last7,
        last30: recentSessions.length,
        activeTrainees30: perTrainee.size,
        completedCycles,
        completedCycles30,
        daily: daily.map(({ label, count }) => ({ label, count })),
        top,
        idle: idle.slice(0, 8),
        idleTotal: idle.length,
        idleDays: IDLE_DAYS,
      },
      library: {
        courses: courses.length,
        exercises: exerciseCount,
        topCourses: ranked(courseUse, 6),
        muscles: ranked(muscleCounts),
      },
      diet: {
        templates: templates.size,
        prescribed: dietPlans.length - dietPlans.filter((d) => !d.profile_id).length,
        traineesWithDiet: dietTrainees.size,
        foods: foodCategories.reduce((sum, f) => sum + f._count._all, 0),
        categories: ranked(foodCounts),
      },
      staff: {
        coach: { courses: madeCourses.get("") ?? 0, dietPlans: madeDiet.get("") ?? 0 },
        members: staff.map((s) => ({
          name: s.accounts.username,
          isSuspended: s.is_suspended,
          trainees: s._count.staff_trainees,
          courses: madeCourses.get(s.account_id) ?? 0,
          dietPlans: madeDiet.get(s.account_id) ?? 0,
        })),
      },
    };
  } catch (error) {
    /* The screen still renders — with a note in place of the numbers — rather
       than taking the panel down with it. */
    console.error("Failed to build analytics:", error);
  }

  return <AnalyticsClient data={data} />;
}
