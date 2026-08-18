import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import AdminDietClient from "./AdminDietClient";
import type { NutritionSource } from "@/types/admin";

export const dynamic = "force-dynamic";

export default async function AdminDietPage() {
  /* The proxy already turned strangers away before this rendered — but a
     matcher is a list of paths, and this page reads every subscriber it can
     find. It proves the caller for itself rather than inheriting the answer.
     See @/lib/authGuard. */
  await requireAdminPage();

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
