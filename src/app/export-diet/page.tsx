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

export default async function ExportDietPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>;
}) {
  const session = await requireUserPage();

  const { profileId } = await searchParams;
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
