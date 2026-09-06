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
  searchParams: Promise<{ traineeId?: string; groupId?: string }>;
}) {
  /* The proxy already turned strangers away before this rendered — but a
     matcher is a list of paths, and this page reads every subscriber it can
     find. It proves the caller for itself rather than inheriting the answer.
     See @/lib/authGuard. */
  await requireAdminPage();

  const { traineeId, groupId } = await searchParams;
  const selectedTraineeId = traineeId && isValidUUID(traineeId) ? traineeId : "";

  /* With no trainee named, this screen writes a general template — a diet with
     no owner, the way the programme builder saves a course with nobody on it.
     `?groupId=` edits one that already exists, with both of its choices;
     without it the coach starts a new one. A trainee in the query wins: the two
     are different documents and `?traineeId=` is the more specific address. */
  const generalGroupId = !selectedTraineeId && groupId && isValidUUID(groupId) ? groupId : "";

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
    } else if (generalGroupId) {
      /* Both choices of the template, in slot order — the same shape and the
         same ordering the trainee branch above reads, so the builder's tabs
         work on either without knowing which it is looking at.

         `profile_id: null` is part of the lookup, not something checked after
         it: a hand-edited ?groupId= cannot reach a prescribed diet, and no
         prescribed row carries a group_id in the first place. */
      const rows = await prisma.diet_plans.findMany({
        where: { group_id: generalGroupId, profile_id: null },
        orderBy: { position: "asc" },
        select: { id: true, name: true, position: true, meals_data: true },
      });
      plans = rows.map((row) => ({
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
          /* Builder state is seeded from these props, so switching trainee —
             or moving between general plans — has to remount rather than keep
             the previous document's meals on screen. */
          key={selectedTraineeId || `general:${generalGroupId || "new"}`}
          trainees={trainees}
          sources={sources}
          initialPlans={plans}
          initialTraineeId={selectedTraineeId}
          initialGeneralGroupId={generalGroupId}
        />
      </div>
    </div>
  );
}
