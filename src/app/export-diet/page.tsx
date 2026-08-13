import React from "react";
import { prisma } from "@/lib/db";
import { requireUserPage, sessionOwnsProfile } from "@/lib/authGuard";
import { readIntakeData } from "@/lib/intakeData";
import { asMeals, type DietPlan } from "@/types/diet";
import ExportDietClient from "./ExportDietClient";
import { notFound } from "next/navigation";
import type { JsonRecord } from "@/types";
import { t, type TranslationKey } from "@/lib/translations";

export const dynamic = "force-dynamic";

export default async function ExportDietPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>;
}) {
  const session = await requireUserPage();

  const { profileId } = await searchParams;
  if (!profileId) notFound();

  /* Printable and therefore shareable, but not readable by anyone who guesses an
     id. A profile that belongs to somebody else is answered as "not found",
     exactly like one that does not exist. */
  if (!(await sessionOwnsProfile(session, profileId))) notFound();

  const profile = await prisma.profiles.findUnique({ where: { id: profileId } });
  if (!profile) notFound();

  const data: JsonRecord = readIntakeData(profile.data);

  const dietPlanRows = await prisma.diet_plans.findMany({
    where: { profile_id: profile.id },
    orderBy: { position: "asc" },
    select: { id: true, name: true, position: true, meals_data: true },
  });

  const dietPlans: DietPlan[] = dietPlanRows.map((row) => ({
    id: row.id,
    name: row.name,
    position: row.position,
    meals: asMeals(row.meals_data),
  }));

  const traineeName = String(data.fullname || profile.username || "المشترك");
  const planName = String(data.plan || "خطة التغذية المخصصة");
  const weight = data.weight ? `${data.weight} كجم` : "غير محدد";
  const height = data.height ? `${data.height} سم` : "غير محدد";
  const goalRaw = String(data.sub_goal || data.goal || "تحسين البنية واللياقة");
  const goal = t(goalRaw as TranslationKey);
  const allergies = String(data.allergies || "لا توجد موانع أو حساسية");

  return (
    <ExportDietClient
      traineeName={traineeName}
      planName={planName}
      weight={weight}
      height={height}
      goal={goal}
      allergies={allergies}
      dietPlans={dietPlans}
      profileId={profile.id}
    />
  );
}
