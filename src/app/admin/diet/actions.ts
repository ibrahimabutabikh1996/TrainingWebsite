"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminAction } from "@/lib/authGuard";
import type { NutritionSource } from "@/types/admin";
import { STORAGE_PUBLIC_MARKER } from "@/lib/supabaseAdmin";

/* The nutrition library is the coach's reference table — shared by every
   trainee's plan, so one edit reaches all of them. Each action checks the
   caller: a server action is a public endpoint, and being called from a page
   behind the proxy proves nothing about the request that actually arrives. */

const DENIED = { success: false as const, error: "غير مصرح لك بهذا الإجراء" };

const stripHamzas = (text?: string | null) => {
  if (!text) return text;
  return text.replace(/[أإآ]/g, "ا");
};

/* ------------------------------------------------------------------ *
 * Narrowing what actually reaches the table
 *
 * A server action takes whatever the request carries, not what the form on the
 * other side happened to render. These fields went in untouched: a name of any
 * length, a category outside the five the UI offers, and — now that the card
 * finally renders it — an `image_url` pointing anywhere at all.
 * ------------------------------------------------------------------ */

/** Long enough for the longest real food name, short enough to be a cell. */
const MAX_NAME = 120;
const MAX_SHORT = 80;
const MAX_NOTES = 1_000;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * `Decimal(6,2)` — four digits before the point, two after. A larger number
 * raises a numeric-overflow error from Postgres that surfaces as "تعذّر إضافة
 * المصدر الغذائي", which tells the coach nothing about the 99999 they typed.
 * Negatives are refused for the same reason they are meaningless here.
 */
function macro(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 9999.99) return null;
  return Math.round(n * 100) / 100;
}

/**
 * An address this application produced, or nothing.
 *
 * The field is written by the upload above, which returns a public URL inside
 * the project's own bucket. Accepting anything else means the panel fetches
 * images from wherever a crafted request says — and stores the instruction to
 * keep doing it. `null` simply falls back to the category picture.
 */
function storedImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.includes(STORAGE_PUBLIC_MARKER) ? trimmed.slice(0, 500) : null;
}

function narrow(data: Omit<NutritionSource, "id" | "created_at">) {
  return {
    name: stripHamzas(text(data.name, MAX_NAME)) || "",
    category: stripHamzas(text(data.category, MAX_SHORT)) || "",
    image_url: storedImageUrl(data.image_url),
    serving_size: text(data.serving_size, MAX_SHORT),
    calories: macro(data.calories),
    protein: macro(data.protein),
    carbs: macro(data.carbs),
    fats: macro(data.fats),
    notes: text(data.notes, MAX_NOTES),
  };
}

export async function addNutritionSource(
  data: Omit<NutritionSource, "id" | "created_at">
) {
  if (!(await requireAdminAction())) return DENIED;

  const fields = narrow(data);
  if (!fields.name) {
    return { success: false as const, error: "اسم المصدر الغذائي مطلوب" };
  }

  try {
    const created = await prisma.nutrition_sources.create({ data: fields });
    revalidatePath("/admin/diet");
    return { success: true, id: created.id };
  } catch (error) {
    console.error("Failed to add nutrition source:", error);
    return { success: false, error: "تعذّر إضافة المصدر الغذائي" };
  }
}

export async function updateNutritionSource(
  id: string,
  data: Omit<NutritionSource, "id" | "created_at">
) {
  if (!(await requireAdminAction())) return DENIED;

  const fields = narrow(data);
  if (!fields.name) {
    return { success: false as const, error: "اسم المصدر الغذائي مطلوب" };
  }

  try {
    await prisma.nutrition_sources.update({ where: { id }, data: fields });
    revalidatePath("/admin/diet");
    return { success: true };
  } catch (error) {
    console.error("Failed to update nutrition source:", error);
    return { success: false, error: "تعذّر تعديل المصدر الغذائي" };
  }
}

export async function deleteNutritionSource(id: string) {
  if (!(await requireAdminAction())) return DENIED;

  try {
    await prisma.nutrition_sources.delete({
      where: { id },
    });
    revalidatePath("/admin/diet");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete nutrition source:", error);
    return { success: false, error: "تعذّر حذف المصدر الغذائي" };
  }
}
