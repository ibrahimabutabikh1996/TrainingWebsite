import { prisma } from "@/lib/db";
import AdminDietClient from "./AdminDietClient";
import type { NutritionSource } from "@/types/admin";

export const dynamic = "force-dynamic";

export default async function AdminDietPage() {
  let sources: NutritionSource[] = [];

  try {
    const rows = await prisma.nutrition_sources.findMany({
      orderBy: { created_at: "desc" },
    });
    sources = rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      image_url: r.image_url,
      serving_size: r.serving_size,
      calories: r.calories ? Number(r.calories) : null,
      protein: r.protein ? Number(r.protein) : null,
      carbs: r.carbs ? Number(r.carbs) : null,
      fats: r.fats ? Number(r.fats) : null,
      notes: r.notes,
      created_at: r.created_at,
    }));
  } catch (error) {
    console.error("Failed to fetch nutrition sources:", error);
  }

  return (
    <div className="crm-dashboard">
      <div className="crm-main-area">
        <AdminDietClient initialSources={sources} />
      </div>
    </div>
  );
}
