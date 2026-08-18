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
