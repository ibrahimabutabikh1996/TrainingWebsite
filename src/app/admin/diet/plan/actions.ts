"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/authGuard";
import { asMeals, MAX_PLANS_PER_TRAINEE, type MealsData } from "@/types/diet";

/* Prescribing food to a named trainee is the coach's act, so both actions ask
   who is calling before they read the input. A server action is reachable on
   its own, whatever page it was written for. */
const DENIED = { success: false as const, error: "غير مصرح لك بهذا الإجراء" };

/* traineeId arrives from a query string, so it can be any string. The column is
   uuid, and handing Postgres a non-uuid raises P2007 — caught below, but it
   costs a round trip and buries a real stack trace in the logs. */
const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function revalidateFor(traineeId: string) {
  revalidatePath("/admin/diet/plan");
  revalidatePath(`/admin/profile/${traineeId}`);
}

export async function saveDietPlanAction(input: {
  traineeId: string;
  position: number;
  name: string;
  meals: unknown;
}) {
  if (!(await requireAdminAction())) return DENIED;

  const { traineeId, position } = input;

  if (!isValidUUID(traineeId)) {
    return { success: false as const, error: "لم يتم تحديد المشترك" };
  }
  if (!Number.isInteger(position) || position < 1 || position > MAX_PLANS_PER_TRAINEE) {
    return { success: false as const, error: "رقم النظام غير صالح" };
  }

  /* Checked for being a string before it is trimmed, and capped after.
     `input.name` is typed `string`, but a server action is reached over HTTP and
     receives whatever the request carries — a number here made `.trim()` throw a
     TypeError from outside the try block below, which reaches the caller as an
     unhandled server-action rejection rather than an error message. */
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
  if (!name) {
    return { success: false as const, error: "اسم النظام الغذائي مطلوب" };
  }

  /* Re-narrowed here rather than trusted: asMeals is the same function the page
     reads rows back through, so anything it rejects could never have been read
     anyway, and a hand-crafted request cannot park arbitrary json in the column. */
  const meals: MealsData = asMeals(input.meals);

  try {
    const profile = await prisma.profiles.findUnique({
      where: { id: traineeId },
      select: { id: true },
    });
    if (!profile) {
      return { success: false as const, error: "المشترك غير موجود" };
    }

    /* Upsert on (profile_id, position) — the unique index the migration creates.
       Saving the same slot twice must update it, never add a second row. */
    const saved = await prisma.diet_plans.upsert({
      where: { profile_id_position: { profile_id: traineeId, position } },
      create: { profile_id: traineeId, position, name, meals_data: meals },
      update: { name, meals_data: meals },
      select: { id: true },
    });

    revalidateFor(traineeId);
    return { success: true as const, id: saved.id };
  } catch (error) {
    console.error("Failed to save diet plan:", error);
    return { success: false as const, error: "تعذّر حفظ النظام الغذائي" };
  }
}

export async function deleteDietPlanAction(input: { traineeId: string; position: number }) {
  if (!(await requireAdminAction())) return DENIED;

  const { traineeId, position } = input;

  if (!isValidUUID(traineeId)) {
    return { success: false as const, error: "لم يتم تحديد المشترك" };
  }

  try {
    /* deleteMany, not delete: removing a slot that was never saved is a no-op,
       not a P2025 the caller has to special-case. */
    await prisma.diet_plans.deleteMany({
      where: { profile_id: traineeId, position },
    });

    revalidateFor(traineeId);
    return { success: true as const };
  } catch (error) {
    console.error("Failed to delete diet plan:", error);
    return { success: false as const, error: "تعذّر حذف النظام الغذائي" };
  }
}

/* ------------------------------------------------------------------ *
 * General plans — a diet with no trainee on it
 * ------------------------------------------------------------------ *
 *
 * The two actions above are keyed on (trainee, slot), which is what a
 * prescribed diet is: this trainee's first plan, this trainee's second. A
 * general plan has neither. It is a document the coach wrote before deciding
 * who it is for — the diet side of a course saved with no trainee selected —
 * so it is addressed by its own id, there is no cap on how many may exist, and
 * `position` stays at its default because it has no slot to occupy.
 *
 * They are written as their own pair rather than as extra branches inside
 * `saveDietPlanAction` and `deleteDietPlanAction` on purpose: those two are the
 * path every prescribed diet in the product goes through, and widening their
 * input to make `traineeId` optional would put the trainee case one mistaken
 * `if` away from writing a plan that belongs to nobody. Nothing above this
 * comment changed.
 *
 * A general plan reaches a trainee through `copyDietPlanToTraineeAction` in
 * ../library/actions.ts, which takes a copy. Never a shared row — see the note
 * there for why that distinction is the whole point.
 */

/** Where a general plan is read and written from. */
function revalidateGeneral() {
  revalidatePath("/admin/diet/library");
  revalidatePath("/admin/diet/plan");
}

/**
 * One choice of one general template.
 *
 * Saved a choice at a time, the way the trainee branch saves a slot at a time,
 * because that is what the builder holds: a list of alternatives of which some
 * are dirty. `groupId` is what makes two rows alternatives of each other, and
 * the first save of a brand-new template is the one call that does not have one
 * yet — the server mints it and hands it back, so every later choice and every
 * later edit names it.
 */
export async function saveGeneralDietPlanAction(input: {
  /** Present once the template exists; absent on the very first save. */
  groupId?: string;
  /** Present when this choice is already a row; absent when it is being added. */
  planId?: string;
  position: number;
  name: string;
  /** The template's own name — what the library card is called. */
  groupName: string;
  meals: unknown;
}) {
  if (!(await requireAdminAction())) return DENIED;

  /* Checked for being a string before it is trimmed, and capped after — the
     same reasoning `saveDietPlanAction` gives: a server action is reached over
     HTTP and receives whatever the request carries, and `.trim()` on a number
     throws from outside the try block below. */
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
  if (!name) {
    return { success: false as const, error: "اسم النظام الغذائي مطلوب" };
  }

  /* Named the same way, and required for the same reason `name` is: the
     library card carries this, and a template with no name of its own is the
     card that had to borrow its first choice's. */
  const groupName = typeof input.groupName === "string" ? input.groupName.trim().slice(0, 120) : "";
  if (!groupName) {
    return { success: false as const, error: "اسم النظام الغذائي العام مطلوب" };
  }

  const { position } = input;
  if (!Number.isInteger(position) || position < 1 || position > MAX_PLANS_PER_TRAINEE) {
    return { success: false as const, error: "رقم النظام غير صالح" };
  }

  if (input.planId !== undefined && !isValidUUID(input.planId)) {
    return { success: false as const, error: "معرّف النظام غير صالح" };
  }
  if (input.groupId !== undefined && !isValidUUID(input.groupId)) {
    return { success: false as const, error: "معرّف القالب غير صالح" };
  }

  const meals: MealsData = asMeals(input.meals);

  try {
    if (input.planId) {
      /* updateMany with `profile_id: null` in the filter, not update by id:
         it makes the "this row has no owner" check part of the write itself, so
         a hand-crafted request naming a trainee's plan updates nothing rather
         than rewriting a prescribed diet through the general path. A count of
         zero is that refusal, and it is also simply "the plan is gone".

         `group_id` and `position` are not touched: which template a choice
         belongs to, and which choice it is, are decided when the row is created
         and are not the coach's to retype. */
      const { count } = await prisma.diet_plans.updateMany({
        where: { id: input.planId, profile_id: null },
        data: { name, meals_data: meals },
      });
      if (count === 0) {
        return { success: false as const, error: "النظام العام غير موجود" };
      }
      /* The name belongs to the template, not to the choice being saved, so it
         is written across the whole group — two choices disagreeing about what
         their own template is called is a card whose title depends on which row
         the library read first. `profile_id: null` for the reason the update
         above gives. */
      if (input.groupId) {
        await prisma.diet_plans.updateMany({
          where: { group_id: input.groupId, profile_id: null },
          data: { group_name: groupName },
        });
      }
      revalidateGeneral();
      return { success: true as const, id: input.planId, groupId: input.groupId ?? "" };
    }

    /* A template with no group yet is a template being created right now, so it
       gets one. Minted here rather than in the browser for the same reason the
       coach id is: the server is what decides the identity of a row it is about
       to write. */
    const groupId = input.groupId || crypto.randomUUID();

    const created = await prisma.diet_plans.create({
      data: { profile_id: null, group_id: groupId, group_name: groupName, position, name, meals_data: meals },
      select: { id: true },
    });

    /* A choice added to a template renamed in the same press: the rows that
       already existed carry the old name until they are told, and only this
       call knows the new one. Skipped when there is no group yet — the row
       just created is the whole template. */
    if (input.groupId) {
      await prisma.diet_plans.updateMany({
        where: { group_id: input.groupId, profile_id: null },
        data: { group_name: groupName },
      });
    }

    revalidateGeneral();
    return { success: true as const, id: created.id, groupId };
  } catch (error) {
    /* Two saves racing for the same choice of the same template both miss the
       update above and then meet uq_diet_plans_group_position. That is the
       index doing its job — say so in the coach's terms. */
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return { success: false as const, error: "هذا الخيار محفوظ بالفعل — أعد تحميل الصفحة" };
    }
    console.error("Failed to save general diet plan:", error);
    return { success: false as const, error: "تعذّر حفظ النظام الغذائي" };
  }
}

/**
 * A whole general template — every choice in it.
 *
 * What the library's delete button removes, because a card there is a template
 * rather than one of its alternatives. The builder deletes a single choice
 * through `deleteGeneralDietPlanAction` below.
 */
export async function deleteGeneralDietGroupAction(input: { groupId: string }) {
  if (!(await requireAdminAction())) return DENIED;

  if (!isValidUUID(input.groupId)) {
    return { success: false as const, error: "معرّف القالب غير صالح" };
  }

  try {
    await prisma.diet_plans.deleteMany({
      where: { group_id: input.groupId, profile_id: null },
    });

    revalidateGeneral();
    return { success: true as const };
  } catch (error) {
    console.error("Failed to delete general diet template:", error);
    return { success: false as const, error: "تعذّر حذف النظام الغذائي" };
  }
}

export async function deleteGeneralDietPlanAction(input: { planId: string }) {
  if (!(await requireAdminAction())) return DENIED;

  if (!isValidUUID(input.planId)) {
    return { success: false as const, error: "معرّف النظام غير صالح" };
  }

  try {
    /* `profile_id: null` in the filter for the same reason as the update above:
       this action cannot reach a plan that belongs to somebody, whatever id it
       is handed. deleteMany, so removing one that has already gone is a no-op
       rather than a P2025 the caller has to special-case. */
    await prisma.diet_plans.deleteMany({
      where: { id: input.planId, profile_id: null },
    });

    revalidateGeneral();
    return { success: true as const };
  } catch (error) {
    console.error("Failed to delete general diet plan:", error);
    return { success: false as const, error: "تعذّر حذف النظام الغذائي" };
  }
}
