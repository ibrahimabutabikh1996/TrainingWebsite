"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { NutritionSource } from "@/types/admin";

export async function addNutritionSource(
  data: Omit<NutritionSource, "id" | "created_at">
) {
  try {
    const created = await prisma.nutrition_sources.create({
      data: {
        name: data.name,
        category: data.category,
        image_url: data.image_url,
        serving_size: data.serving_size,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        notes: data.notes,
      },
    });
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
  try {
    await prisma.nutrition_sources.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        image_url: data.image_url,
        serving_size: data.serving_size,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        notes: data.notes,
      },
    });
    revalidatePath("/admin/diet");
    return { success: true };
  } catch (error) {
    console.error("Failed to update nutrition source:", error);
    return { success: false, error: "تعذّر تعديل المصدر الغذائي" };
  }
}

export async function deleteNutritionSource(id: string) {
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
