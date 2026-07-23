import { prisma } from "@/lib/db";
import AdminExercisesClient from "./AdminExercisesClient";

export const dynamic = "force-dynamic"; // Ensure fresh data on load

export default async function AdminExercisesPage() {
  const exercises = await prisma.exercises.findMany({
    orderBy: { created_at: "desc" }
  });

  // Serialize dates and objects
  const serializedExercises = exercises.map(ex => ({
    id: ex.id,
    name_ar: ex.name_ar,
    name_en: ex.name_en,
    target_muscle: ex.target_muscle,
    video_url: ex.video_url,
    notes: ex.notes,
    category: ex.category
  }));

  return (
    <div style={{ padding: "32px", maxWidth: 1200, margin: "0 auto", minHeight: "100vh" }}>
      <AdminExercisesClient initialExercises={serializedExercises} />
    </div>
  );
}
