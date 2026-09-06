import React from "react";
import { prisma } from "@/lib/db";
import { requireUserPage, sessionOwnsProfile } from "@/lib/authGuard";
import { readIntakeData } from "@/lib/intakeData";
import { asMeals, type DietPlan } from "@/types/diet";
import { subscriptionStartOf } from "@/lib/subscription";
import { answerLabel } from "@/lib/formLabels";
import ExportDietClient from "./ExportDietClient";
import { notFound } from "next/navigation";
import type { JsonRecord } from "@/types";

export const dynamic = "force-dynamic";

// Simple UUID validation, so a hand-edited query string can't reach Prisma.
const isValidUUID = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

export default async function ExportDietPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string; groupId?: string }>;
}) {
  const session = await requireUserPage();

  const { profileId, groupId } = await searchParams;

  /* A general template — a diet written for nobody yet, printed straight from
     the library. The training sheet has always been able to do this:
     /export-workout?courseId= prints an unassigned course and leaves the name,
     date, weight, height and goal as dashes, because "a course opened from the
     library belongs to nobody, and a made-up date on it would be worse than
     none." This is the same page for the diet side.

     Admins only, and that is not the same check as the one below. A template
     has no owner, so `sessionOwnsProfile` has nothing to ask about it — the
     coach's library is not something a trainee may page through by guessing a
     uuid. The whole branch returns before the prescribed path begins, which is
     left exactly as it was. */
  if (groupId) {
    if (!session.isAdmin || !isValidUUID(groupId)) notFound();

    const rows = await prisma.diet_plans.findMany({
      where: { group_id: groupId, profile_id: null },
      orderBy: { position: "asc" },
      select: { id: true, name: true, position: true, meals_data: true },
    });
    if (rows.length === 0) notFound();

    const templatePlans: DietPlan[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      position: row.position,
      meals: asMeals(row.meals_data),
    }));

    return (
      <ExportDietClient
        /* The template's own name, so the sheet and the file it downloads as
           are identifiable. The four fields below it describe a person, and
           there is no person — dashes rather than invented values. */
        traineeName={templatePlans[0].name}
        startDate="—"
        weight="—"
        height="—"
        goal="—"
        dietPlans={templatePlans}
        groupId={groupId}
      />
    );
  }

  if (!profileId) notFound();

  if (!(await sessionOwnsProfile(session, profileId))) notFound();

  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
  });
  if (!profile) notFound();

  const data: JsonRecord = readIntakeData(profile.data);

  let traineeName = "المشترك";
  if (data?.fullname) traineeName = String(data.fullname);
  else if (profile.username) traineeName = profile.username;

  /* Was `toISODate(new Date())` — today's date under a label that says
     "تاريخ الاشتراك". Shared with the training sheet so the two cannot drift
     into printing different start dates for the same subscriber. */
  const startDateStr = subscriptionStartOf(data?.activation_date, profile.created_at);
  const weight = data?.weight ? `${data.weight} كغم` : "—";
  const height = data?.height ? `${data.height} سم` : "—";
  
  let goal = "—";
  if (data?.sub_goal || data?.goal || data?.target_weight) {
    goal = answerLabel(data.sub_goal || data.goal || `الوصول لـ ${data.target_weight} كغم`, "—");
  }

  const dietPlanRows = await prisma.diet_plans.findMany({
    where: { profile_id: profile.id },
    orderBy: { position: "asc" },
  });

  const dietPlans: DietPlan[] = dietPlanRows.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position,
    meals: asMeals(row.meals_data),
  }));

  if (dietPlans.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px", fontFamily: "'Cairo', sans-serif" }}>
        <h2>لا يوجد نظام غذائي مخصص لهذا المشترك بعد.</h2>
      </div>
    );
  }

  return (
    <ExportDietClient
      traineeName={traineeName}
      startDate={startDateStr}
      weight={weight}
      height={height}
      goal={goal}
      dietPlans={dietPlans}
      profileId={profile.id}
    />
  );
}
