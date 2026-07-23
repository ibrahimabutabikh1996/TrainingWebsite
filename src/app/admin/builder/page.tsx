import { prisma } from "@/lib/db";
import AdminBuilderClient from "./AdminBuilderClient";

export const dynamic = "force-dynamic";

export default async function AdminBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string; traineeId?: string }>;
}) {
  let profiles: any[] = [];
  let exercises: any[] = [];
  let courseToEdit = null;
  
  const { courseId, traineeId } = await searchParams;
  let assignedTraineeId = traineeId || "";

  // Simple UUID regex validation to prevent Prisma query errors
  const isValidUUID = (uuid: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

  try {
    profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
    });
    
    exercises = await prisma.exercises.findMany({
      orderBy: { name_ar: "asc" },
    });

    if (courseId && isValidUUID(courseId)) {
      courseToEdit = await prisma.courses.findUnique({
        where: { id: courseId },
      });
      if (courseToEdit) {
        const assignedProfile = await prisma.profiles.findFirst({
          where: { current_course_id: courseId },
        });
        if (assignedProfile) {
          assignedTraineeId = assignedProfile.id;
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch data for admin builder:", error);
  }

  const serializedProfiles = profiles.map(p => ({
    id: p.id,
    username: p.username,
    created_at: p.created_at?.toISOString() || null,
    data: p.data || {},
  }));

  const serializedExercises = exercises.map(ex => ({
    id: ex.id,
    name_ar: ex.name_ar,
    name_en: ex.name_en || null,
    target_muscle: ex.target_muscle || null,
    video_url: ex.video_url || null,
    notes: ex.notes || null,
    category: ex.category || null,
  }));

  const serializedCourseToEdit = courseToEdit ? {
    id: courseToEdit.id,
    name: courseToEdit.name,
    days_data: courseToEdit.days_data || [],
  } : null;

  return (
    <AdminBuilderClient 
      initialProfiles={serializedProfiles} 
      initialExercises={serializedExercises} 
      initialCourse={serializedCourseToEdit}
      initialTraineeId={assignedTraineeId}
    />
  );
}
