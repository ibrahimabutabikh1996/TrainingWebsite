import React from "react";
import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/trainingDates";
import ExportWorkoutClient from "@/app/export-workout/ExportWorkoutClient";
import { answerLabel } from "@/lib/formLabels";

export const dynamic = "force-dynamic";

export default async function ExportWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; cycleId?: string; profileId?: string }>;
}) {
  const { courseId, cycleId, profileId } = await searchParams;

  let title = "النظام التدريبي";
  let traineeName = "المشترك";
  let startDateStr = toISODate(new Date());
  let weight = "—";
  let height = "—";
  let goal = "—";
  let rawDays: any[] = [];

  if (courseId) {
    const course = await prisma.courses.findUnique({ where: { id: courseId } });
    if (course) {
      title = course.name || title;
      rawDays = Array.isArray(course.days_data) ? (course.days_data as any[]) : [];
    }
  } else if (cycleId) {
    const cycle = await prisma.training_cycles.findUnique({
      where: { id: cycleId },
    });
    if (cycle) {
      title = `الجولة التدريبية رقم ${cycle.cycle_number}`;
      rawDays = Array.isArray(cycle.plan_data) ? (cycle.plan_data as any[]) : [];
      if (cycle.profile_id) {
        const prof = await prisma.profiles.findUnique({ where: { id: cycle.profile_id } });
        if (prof) {
          let pData: any = {};
          try { pData = typeof prof.data === "string" ? JSON.parse(prof.data) : (prof.data || {}); } catch {}
          traineeName = pData?.fullname || prof.username || traineeName;
          if (pData?.weight) weight = `${pData.weight} كغم`;
          if (pData?.height) height = `${pData.height} سم`;
          if (pData?.sub_goal || pData?.goal || (prof as any).goal || pData?.target_weight) {
            goal = answerLabel(pData.sub_goal || pData.goal || (prof as any).goal || `الوصول لـ ${pData.target_weight} كغم`, "—");
          }
        }
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
      rawDays = Array.isArray(cycle.plan_data) ? (cycle.plan_data as any[]) : [];
    }
    const prof = await prisma.profiles.findUnique({ where: { id: profileId } });
    if (prof) {
      let pData: any = {};
      try { pData = typeof prof.data === "string" ? JSON.parse(prof.data) : (prof.data || {}); } catch {}
      traineeName = pData?.fullname || prof.username || traineeName;
      if (pData?.weight) weight = `${pData.weight} كغم`;
      if (pData?.height) height = `${pData.height} سم`;
      if (pData?.sub_goal || pData?.goal || (prof as any).goal || pData?.target_weight) {
        goal = answerLabel(pData.sub_goal || pData.goal || (prof as any).goal || `الوصول لـ ${pData.target_weight} كغم`, "—");
      }
      if (rawDays.length === 0 && prof.current_course_id) {
        const c = await prisma.courses.findUnique({ where: { id: prof.current_course_id } });
        if (c && Array.isArray(c.days_data)) {
          title = c.name || title;
          rawDays = c.days_data as any[];
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
