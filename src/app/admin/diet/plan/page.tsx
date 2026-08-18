import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import DietPlanBuilder from "./DietPlanBuilder";
import { asMeals, type DietPlan } from "@/types/diet";
import type { NutritionSource, TraineeOption } from "@/types/admin";

export const dynamic = "force-dynamic";

// Simple UUID validation, so a hand-edited query string can't reach Prisma.
const isValidUUID = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

function parseData(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) ?? {};
    } catch {
      return {};
    }
  }
  return (raw as Record<string, unknown>) ?? {};
}

export default async function DietPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ traineeId?: string }>;
}) {
  /* The proxy already turned strangers away before this rendered — but a
     matcher is a list of paths, and this page reads every subscriber it can
     find. It proves the caller for itself rather than inheriting the answer.
     See @/lib/authGuard. */
  await requireAdminPage();

  const { traineeId } = await searchParams;
  const selectedTraineeId = traineeId && isValidUUID(traineeId) ? traineeId : "";

  let trainees: TraineeOption[] = [];
  let sources: NutritionSource[] = [];
  let plans: DietPlan[] = [];

  try {
    const profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, username: true, data: true },
    });

    /* Only the id and a display name cross to the browser — the intake blob
       holds phone numbers and health history, and a dropdown needs neither. */
    trainees = profiles.map((p) => {
      const data = parseData(p.data);
      const fullname = typeof data.fullname === "string" ? data.fullname : "";
      return { id: p.id, name: fullname || p.username, username: p.username };
    });

    const rows = await prisma.nutrition_sources.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    sources = rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      image_url: r.image_url,
      calories: r.calories ? Number(r.calories) : null,
      protein: r.protein ? Number(r.protein) : null,
      carbs: r.carbs ? Number(r.carbs) : null,
      fats: r.fats ? Number(r.fats) : null,
      serving_size: r.serving_size,
      notes: r.notes,
      created_at: r.created_at,
    }));

    if (selectedTraineeId) {
      const planRows = await prisma.diet_plans.findMany({
        where: { profile_id: selectedTraineeId },
        orderBy: { position: "asc" },
        select: { id: true, name: true, position: true, meals_data: true },
      });
      plans = planRows.map((row) => ({
        id: row.id,
        name: row.name,
        position: row.position,
        meals: asMeals(row.meals_data),
      }));
    }
  } catch (error) {
    console.error("Failed to fetch data for diet plan builder:", error);
  }

  return (
    <div className="crm-dashboard">
      <div className="crm-main-area">
        <DietPlanBuilder
          /* Builder state is seeded from these props, so switching trainee has
             to remount rather than keep the previous trainee's meals on screen. */
          key={selectedTraineeId || "none"}
          trainees={trainees}
          sources={sources}
          initialPlans={plans}
          initialTraineeId={selectedTraineeId}
        />
      </div>
    </div>
  );
}
