import { prisma } from "@/lib/db";
import AdminBuilderClient from "./AdminBuilderClient";
import type { Exercise, TraineeOption } from "@/types/admin";

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

export default async function AdminBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; traineeId?: string }>;
}) {
  const { courseId, traineeId } = await searchParams;

  let trainees: TraineeOption[] = [];
  let exercises: Exercise[] = [];
  let courseToEdit: { id: string; name: string; description: string; days_data: unknown } | null = null;
  let assignedTraineeId = traineeId && isValidUUID(traineeId) ? traineeId : "";

  try {
    const profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, username: true, data: true },
    });

    /* Only the id and a display name cross to the browser. The previous version
       passed each profile's whole intake blob — phone numbers, health history,
       body-photo URLs — to populate a dropdown. */
    trainees = profiles.map((p) => {
      const data = parseData(p.data);
      const fullname = typeof data.fullname === "string" ? data.fullname : "";
      return {
        id: p.id,
        name: fullname || p.username,
        username: p.username,
      };
    });

    const exerciseRows = await prisma.exercises.findMany({
      orderBy: { name_ar: "asc" },
      select: {
        id: true,
        name_ar: true,
        name_en: true,
        target_muscle: true,
        video_url: true,
        notes: true,
        category: true,
      },
    });
    exercises = exerciseRows.map((ex) => ({
      id: ex.id,
      name_ar: ex.name_ar,
      name_en: ex.name_en ?? null,
      target_muscle: ex.target_muscle ?? null,
      video_url: ex.video_url ?? null,
      notes: ex.notes ?? null,
      category: ex.category ?? null,
    }));

    if (courseId && isValidUUID(courseId)) {
      const course = await prisma.courses.findUnique({
        where: { id: courseId },
        select: { id: true, name: true, description: true, days_data: true },
      });
      if (course) {
        courseToEdit = {
          id: course.id,
          name: course.name,
          description: course.description ?? "",
          days_data: course.days_data ?? [],
        };
        // An explicit ?traineeId= wins; otherwise fall back to the current assignee.
        if (!assignedTraineeId) {
          const assignedProfile = await prisma.profiles.findFirst({
            where: { current_course_id: courseId },
            select: { id: true },
          });
          if (assignedProfile) assignedTraineeId = assignedProfile.id;
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch data for admin builder:", error);
  }

  return (
    <AdminBuilderClient
      /* Builder state is seeded from these props, so a different course or
         trainee has to remount rather than keep the previous form contents. */
      key={`${courseToEdit?.id ?? "new"}:${assignedTraineeId || "none"}`}
      initialTrainees={trainees}
      initialExercises={exercises}
      initialCourse={courseToEdit}
      initialTraineeId={assignedTraineeId}
    />
  );
}
