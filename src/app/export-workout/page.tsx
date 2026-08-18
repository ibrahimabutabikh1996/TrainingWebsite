import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserPage } from "@/lib/authGuard";
import { readIntakeData } from "@/lib/intakeData";
import { toISODate } from "@/lib/trainingDates";
import ExportWorkoutClient from "@/app/export-workout/ExportWorkoutClient";
import { answerLabel } from "@/lib/formLabels";
import { asDays, type Day } from "@/types/admin";

/* Intake answers are whatever the form last wrote, so a value that should be a
   number may be one, a numeric string, or absent. This is only ever used to put
   it on the page. */
const asText = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

export const dynamic = "force-dynamic";

type ExportKeys = { courseId?: string; cycleId?: string; profileId?: string };

/**
 * Whether a trainee may print the sheet these keys name.
 *
 * The three keys are alternatives and the page reads them in this order, so
 * this checks them in the same order: whichever one the page will actually act
 * on is the one that has to be theirs. Checking them in any other order would
 * leave `?courseId=<mine>&profileId=<someone else's>` passing a check on a key
 * the page then ignores.
 *
 * The coach never reaches here — printing other people's sheets is the panel's
 * whole purpose.
 */
async function traineeMayPrint(userId: string, keys: ExportKeys): Promise<boolean> {
  const own = await prisma.profiles.findMany({
    where: { user_id: userId },
    select: { id: true, current_course_id: true },
  });
  if (own.length === 0) return false;

  if (keys.courseId) return own.some((p) => p.current_course_id === keys.courseId);

  if (keys.cycleId) {
    const cycle = await prisma.training_cycles.findUnique({
      where: { id: keys.cycleId },
      select: { profile_id: true },
    });
    return Boolean(cycle && own.some((p) => p.id === cycle.profile_id));
  }

  if (keys.profileId) return own.some((p) => p.id === keys.profileId);

  return false;
}

export default async function ExportWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<ExportKeys>;
}) {
  /* This page prints a named trainee's training sheet, with their name, weight,
     height and goal on it. It had no guard at all — `/export-workout` was in
     the proxy's matcher, so a visitor had to be signed in as *somebody*, and
     that was the entire check. Any trainee could read any other's by changing
     the id in the address. The sibling pages, /export-diet and /export-profile,
     have checked both of these from the start. */
  const session = await requireUserPage();

  const { courseId, cycleId, profileId } = await searchParams;

  if (!session.isAdmin && !(await traineeMayPrint(session.userId, { courseId, cycleId, profileId }))) {
    notFound();
  }

  let title = "النظام التدريبي";
  let traineeName = "المشترك";
  const startDateStr = toISODate(new Date());
  let weight = "—";
  let height = "—";
  let goal = "—";
  let rawDays: Day[] = [];

  /* The header line on the sheet. Both the cycle branch and the profile branch
     built this from the intake answers with the same six lines of duplicated
     `any` juggling — including a `(prof as any).goal` fallback reading a column
     `profiles` does not have, so it could only ever be undefined. */
  const traineeHeader = (profile: { username: string; data: unknown }) => {
    const answers = readIntakeData(profile.data);
    return {
      name: asText(answers.fullname) || profile.username || "المشترك",
      weight: answers.weight ? `${asText(answers.weight)} كغم` : "—",
      height: answers.height ? `${asText(answers.height)} سم` : "—",
      goal: answerLabel(
        answers.sub_goal ||
          answers.goal ||
          (answers.target_weight ? `الوصول لـ ${asText(answers.target_weight)} كغم` : ""),
        "—"
      ),
    };
  };

  if (courseId) {
    const course = await prisma.courses.findUnique({ where: { id: courseId } });
    if (course) {
      title = course.name || title;
      rawDays = asDays(course.days_data);
    }
    if (profileId) {
      const prof = await prisma.profiles.findUnique({ where: { id: profileId } });
      if (prof) ({ name: traineeName, weight, height, goal } = traineeHeader(prof));
    }
  } else if (cycleId) {
    const cycle = await prisma.training_cycles.findUnique({
      where: { id: cycleId },
    });
    if (cycle) {
      title = `الجولة التدريبية رقم ${cycle.cycle_number}`;
      rawDays = asDays(cycle.plan_data);
      if (cycle.profile_id) {
        const prof = await prisma.profiles.findUnique({ where: { id: cycle.profile_id } });
        if (prof) ({ name: traineeName, weight, height, goal } = traineeHeader(prof));
      }
    }
  } else if (profileId) {
    let cycle = await prisma.training_cycles.findFirst({
      where: { profile_id: profileId, completed_at: null },
      orderBy: { cycle_number: "desc" },
    });
    if (!cycle) {
      cycle = await prisma.training_cycles.findFirst({
        where: { profile_id: profileId },
        orderBy: { cycle_number: "desc" },
      });
    }
    if (cycle) {
      title = `الجولة التدريبية رقم ${cycle.cycle_number}`;
      rawDays = asDays(cycle.plan_data);
    }
    const prof = await prisma.profiles.findUnique({ where: { id: profileId } });
    if (prof) {
      ({ name: traineeName, weight, height, goal } = traineeHeader(prof));

      if (rawDays.length === 0 && prof.current_course_id) {
        const c = await prisma.courses.findUnique({ where: { id: prof.current_course_id } });
        if (c) {
          title = c.name || title;
          rawDays = asDays(c.days_data);
        }
      }
    }
  }

  // Build video and muscle lookup maps
  const allExercises = await prisma.exercises.findMany({
    select: { id: true, name_ar: true, video_url: true, target_muscle: true },
  });
  const videoMap: Record<string, string> = {};
  const muscleMap: Record<string, string> = {};
  allExercises.forEach((e) => {
    if (e.video_url) {
      videoMap[e.id] = e.video_url;
      if (e.name_ar) videoMap[e.name_ar] = e.video_url;
    }
    if (e.target_muscle) {
      muscleMap[e.id] = e.target_muscle;
      if (e.name_ar) muscleMap[e.name_ar] = e.target_muscle;
    }
  });

  return (
    <ExportWorkoutClient
      title={title}
      traineeName={traineeName}
      startDate={startDateStr}
      weight={weight}
      height={height}
      goal={goal}
      days={rawDays}
      videoMap={videoMap}
      muscleMap={muscleMap}
      courseId={courseId}
      cycleId={cycleId}
      profileId={profileId}
    />
  );
}
