"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/authGuard";
import { asMeals, MAX_PLANS_PER_TRAINEE } from "@/types/diet";
import { arabicCount, CHOICE, PLAN } from "@/lib/arabicCount";

/* A server action is a public HTTP endpoint however it reads at the call site,
   so this one asks who is calling before it reads its input — the same rule the
   plan builder's actions and the course builder's actions each state for
   themselves. Deleting from this page reuses `deleteDietPlanAction` in
   ../plan/actions.ts rather than restating it here. */

const DENIED = { success: false as const, error: "غير مصرح لك بهذا الإجراء" };

/* Both ids arrive from the browser, and the columns are uuid. Handing Postgres
   a non-uuid raises P2007 — caught below, but it costs a round trip and buries
   a real stack trace in the logs. */
const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * Gives a trainee their own copy of another trainee's diet plan.
 *
 * A copy, never a shared row — the same rule `assignCourseAction` was rewritten
 * to obey, and for the same reason: two people pointed at one `meals_data` blob
 * means editing it for one silently rewrites the other's, with nothing on
 * screen to say the document is shared. Here the stakes are higher than a
 * programme, because what a trainee may eat is decided by their own allergies
 * and injuries — see the intake panel the plan builder opens.
 *
 * Passing the plan's own owner as `traineeId` is a legitimate call: it lands in
 * their free slot and is how this page duplicates a plan in place.
 */
export async function copyDietPlanToTraineeAction(input: {
  /** Named rows — a prescribed card's choices, or the one of them the coach
      narrowed the copy to. */
  planIds?: string[];
  /** A whole general template — every choice in it. */
  groupId?: string;
  traineeId: string;
}) {
  if (!(await requireAdminAction())) return DENIED;

  const { planIds, groupId, traineeId } = input;

  if (!isValidUUID(traineeId)) {
    return { success: false as const, error: "طلب غير صالح" };
  }
  /* An array reached over HTTP is whatever the request carried, so it is proved
     to be a list of uuids before it is counted as a source — and capped at the
     most rows a card can hold, so no request turns this into a bulk read. */
  const ids = Array.isArray(planIds) ? planIds : [];
  /* Exactly one source. Both would be a caller that does not know what it is
     copying, and neither has nothing to copy. */
  if ((ids.length > 0) === !!groupId) {
    return { success: false as const, error: "طلب غير صالح" };
  }
  if (ids.length > MAX_PLANS_PER_TRAINEE || !ids.every(isValidUUID)) {
    return { success: false as const, error: "طلب غير صالح" };
  }
  if (groupId && !isValidUUID(groupId)) {
    return { success: false as const, error: "طلب غير صالح" };
  }

  try {
    /* A template's choices come across together and in slot order, so the
       trainee's first choice is the template's first choice. Named rows are
       read in slot order too, for the same reason, and a copy narrowed to one
       choice is simply a list of one — which is what lets everything below
       treat every source the same. */
    const [sources, target] = await Promise.all([
      groupId
        ? prisma.diet_plans.findMany({
            where: { group_id: groupId, profile_id: null },
            orderBy: { position: "asc" },
            select: { name: true, meals_data: true },
          })
        : prisma.diet_plans.findMany({
            where: { id: { in: ids } },
            orderBy: { position: "asc" },
            select: { name: true, meals_data: true },
          }),
      prisma.profiles.findUnique({
        where: { id: traineeId },
        select: { id: true },
      }),
    ]);

    if (sources.length === 0) {
      return { success: false as const, error: "النظام الغذائي غير موجود" };
    }
    if (!target) return { success: false as const, error: "المشترك غير موجود" };

    const existing = await prisma.diet_plans.findMany({
      where: { profile_id: traineeId },
      select: { position: true, name: true },
    });

    /* The slots the target is not already using. `MAX_PLANS_PER_TRAINEE` is an
       application rule, not a constraint on the table — so it is enforced here,
       exactly as the builder enforces it when adding a plan. */
    const taken = new Set(existing.map((p) => p.position));
    const free: number[] = [];
    for (let p = 1; p <= MAX_PLANS_PER_TRAINEE; p++) {
      if (!taken.has(p)) free.push(p);
    }

    if (free.length < sources.length) {
      return {
        success: false as const,
        /* Counted through arabicCount rather than interpolated: the noun
           changes with the number, and "2 أنظمة" is the exact shape that file
           was written to stop. */
        error:
          free.length === 0
            ? `لدى المشترك ${arabicCount(MAX_PLANS_PER_TRAINEE, PLAN)} بالفعل — احذف أحدها أولاً`
            : /* The dialog now carries a select for exactly this case, so the
                 refusal names it before it names the destructive way out. */
              `هذا النظام يحمل ${arabicCount(sources.length, CHOICE)} ولدى المشترك خانة واحدة فارغة — اختر خياراً واحداً لنسخه، أو احذف أحد أنظمته أولاً`,
      };
    }

    /* Names are not unique in the database and do not need to be, but two rows
       with the same name are two tabs the coach cannot tell apart — which is
       what happens when a plan is duplicated onto its own owner. Capped at the
       same 120 characters `saveDietPlanAction` caps at, so a copy can never be
       longer than a plan saved by hand. */
    const usedNames = new Set(existing.map((p) => p.name));
    const rows = sources.map((source, i) => {
      const name = (usedNames.has(source.name) ? `${source.name} (نسخة)` : source.name).slice(0, 120);
      usedNames.add(name);
      return {
        profile_id: traineeId,
        position: free[i],
        name,
        /* Re-narrowed on the way out rather than trusted: `asMeals` is the same
           function every reader of this column goes through, so the copy cannot
           carry a shape the original's readers would have rejected. */
        meals_data: asMeals(source.meals_data),
      };
    });

    /* All of a template's choices land, or none do. Created one at a time
       outside a transaction, a failure on the second would leave the trainee
       holding half a diet the coach believes they gave whole. */
    await prisma.$transaction(rows.map((data) => prisma.diet_plans.create({ data })));

    revalidatePath("/admin/diet/library");
    revalidatePath("/admin/diet/plan");
    revalidatePath(`/admin/profile/${traineeId}`);

    /* The first choice's name, because that is what the toast says was
       created — a template's second choice is not a second thing the coach
       asked for, it came along with it. */
    return { success: true as const, name: rows[0].name, choices: rows.length };
  } catch (error) {
    /* Two copies racing for the same free slot both pass the scan above and
       then meet uq_diet_plans_profile_position. That is the unique index doing
       its job, not a fault — say so in the coach's terms. */
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return { success: false as const, error: "خانة النظام مشغولة الآن — أعد المحاولة" };
    }
    console.error("Failed to copy diet plan:", error);
    return { success: false as const, error: "تعذّر نسخ النظام الغذائي" };
  }
}

/**
 * `base`, or `base 2`, `base 3`… — whichever no template is using.
 *
 * Names are not unique in the database and do not need to be. They are how the
 * coach finds a template in a list of them, though, and three cards reading
 * "نظام التنشيف (نسخة)" are three cards nobody can tell apart. Only general
 * rows are scanned: a trainee's prescribed plan is not in this list and cannot
 * collide with it.
 */
async function uniqueGeneralName(base: string): Promise<string> {
  const taken = new Set(
    (
      await prisma.diet_plans.findMany({
        where: { profile_id: null, name: { startsWith: base } },
        select: { name: true },
      })
    ).map((row) => row.name)
  );

  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n++) {
    if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
  }
  return `${base} ${Date.now()}`;
}

/**
 * Copies a diet into the library as a general template, owned by nobody.
 *
 * The counterpart of `duplicateCourseAction`, and the same act: it creates
 * something and destroys nothing, so it asks no confirmation and the copy is
 * one press of the delete button away.
 *
 * Whatever the source, the result is a general template — that is what this
 * button means, on both kinds of card. Duplicating a template gives a second
 * template to edit apart from the first; duplicating a trainee's prescribed
 * diet lifts it into the library so it can be handed to other people, which is
 * the one route the panel had no way of taking. The trainee's own plan is not
 * touched either way, and neither is anyone already copied from the original.
 */
export async function duplicateDietPlanAction(input: {
  /** Named rows — every choice of a prescribed card. */
  planIds?: string[];
  /** A whole general template — every choice in it. */
  groupId?: string;
}) {
  if (!(await requireAdminAction())) return DENIED;

  const { planIds, groupId } = input;

  /* Proved to be a list of uuids and capped, for the reason the copy action
     gives where it does the same. */
  const ids = Array.isArray(planIds) ? planIds : [];
  /* Exactly one source, for the reason the copy action gives. */
  if ((ids.length > 0) === !!groupId) {
    return { success: false as const, error: "طلب غير صالح" };
  }
  if (ids.length > MAX_PLANS_PER_TRAINEE || !ids.every(isValidUUID)) {
    return { success: false as const, error: "طلب غير صالح" };
  }
  if (groupId && !isValidUUID(groupId)) {
    return { success: false as const, error: "طلب غير صالح" };
  }

  try {
    const sources = groupId
      ? await prisma.diet_plans.findMany({
          where: { group_id: groupId, profile_id: null },
          orderBy: { position: "asc" },
          select: { name: true, meals_data: true },
        })
      : await prisma.diet_plans.findMany({
          where: { id: { in: ids } },
          orderBy: { position: "asc" },
          select: { name: true, meals_data: true },
        });

    if (sources.length === 0) {
      return { success: false as const, error: "النظام الغذائي غير موجود" };
    }

    /* The first choice names the card, so it is the one that has to be
       distinguishable. The rest keep their names: they are read inside the
       template, on tabs that already sit beside each other. */
    const name = await uniqueGeneralName(`${sources[0].name} (نسخة)`);
    const newGroupId = crypto.randomUUID();

    const rows = sources.map((source, i) => ({
      profile_id: null,
      group_id: newGroupId,
      position: i + 1,
      name: (i === 0 ? name : source.name).slice(0, 120),
      /* Read through the same narrowing every reader of this column uses, so a
         legacy row's shape is normalised on the way into the copy rather than
         carried forward for another year. */
      meals_data: asMeals(source.meals_data),
    }));

    /* One transaction: a template that exists with only half its choices is not
       a template the coach asked for. */
    await prisma.$transaction(rows.map((data) => prisma.diet_plans.create({ data })));

    revalidatePath("/admin/diet/library");
    revalidatePath("/admin/diet/plan");

    return { success: true as const, name, groupId: newGroupId, choices: rows.length };
  } catch (error) {
    console.error("Failed to duplicate diet plan:", error);
    return { success: false as const, error: "تعذّر نسخ النظام الغذائي" };
  }
}
