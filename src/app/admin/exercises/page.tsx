import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import AdminExercisesClient from "./AdminExercisesClient";
import LiveRefresh from "@/components/LiveRefresh";
import type { Exercise } from "@/types/admin";

export const dynamic = "force-dynamic"; // Ensure fresh data on load

export default async function AdminExercisesPage() {
  /* The proxy already turned strangers away before this rendered — but a
     matcher is a list of paths, and this page reads every subscriber it can
     find. It proves the caller for itself rather than inheriting the answer.
     See @/lib/authGuard. */
  await requireAdminPage();

  let exercises: Exercise[] = [];

  try {
    const rows = await prisma.exercises.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name_ar: true,
        target_muscle: true,
        video_url: true,
        notes: true,
        category: true,
      },
    });
    exercises = rows.map((ex) => ({
      id: ex.id,
      name_ar: ex.name_ar,
      target_muscle: ex.target_muscle ?? null,
      video_url: ex.video_url ?? null,
      notes: ex.notes ?? null,
      category: ex.category ?? null,
    }));
  } catch (error) {
    // A failed query used to take the whole page down with it.
    console.error("Failed to fetch exercises:", error);
  }

  return (
    /* Same shell as the other admin screens; the old bespoke wrapper had its
       own padding and max-width, which is why this page never lined up. */
    <div className="crm-dashboard">
      {/* The coach's screens follow the panel as a whole: a subscriber who
          registers or asks to renew, a plan saved from another tab. Read-only
          lists, so a refresh arriving mid-look costs nothing. */}
      <LiveRefresh scope="panel" />
      <div className="crm-main-area">
        <AdminExercisesClient initialExercises={exercises} />
      </div>
    </div>
  );
}
