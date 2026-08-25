import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import AdminCoursesClient from "./AdminCoursesClient";
import LiveRefresh from "@/components/LiveRefresh";
import type { Course, CourseAssignments, TraineeOption } from "@/types/admin";

export const dynamic = "force-dynamic";

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

export default async function AdminCoursesPage() {
  /* The proxy already turned strangers away before this rendered — but a
     matcher is a list of paths, and this page reads every subscriber it can
     find. It proves the caller for itself rather than inheriting the answer.
     See @/lib/authGuard. */
  await requireAdminPage();

  let courses: Course[] = [];
  let trainees: TraineeOption[] = [];
  const assignments: CourseAssignments = {};
  const exerciseVideos: Record<string, string> = {};

  try {
    const courseRows = await prisma.courses.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, name: true, description: true, days_data: true, created_at: true },
    });

    courses = courseRows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? "",
      days_data: c.days_data ?? [],
      created_at: c.created_at.toISOString(),
    }));

    /* Only id + display name reach the browser — the intake `data` blob (phone,
       health history, body-photo URLs) has no business in a dropdown. */
    const profileRows = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, username: true, data: true, current_course_id: true },
    });

    trainees = profileRows.map((p) => {
      const data = parseData(p.data);
      const fullname = typeof data.fullname === "string" ? data.fullname : "";
      return { id: p.id, name: fullname || p.username, username: p.username };
    });

    /* Who is on each course. Without this the library gave no hint that a
       course was in use, so deleting one silently unassigned live trainees. */
    profileRows.forEach((p, i) => {
      if (!p.current_course_id) return;
      (assignments[p.current_course_id] ??= []).push(trainees[i].name);
    });

    /* The video column's fallback, keyed by both id and name for the same
       reason the export sheet keys it that way.
       A programme copies `video_url` out of the library when the coach adds the
       exercise, so most rows answer for themselves — but the field was added
       after courses were already being saved, and anything older carries no
       video at all. `refId` traces the origin without a foreign key, so it may
       resolve to nothing; the name is the second chance. Nothing here rewrites
       the programme, it only fills a cell that would otherwise read empty on
       every course built before the copy existed. */
    const libraryRows = await prisma.exercises.findMany({
      select: { id: true, name_ar: true, video_url: true },
    });
    libraryRows.forEach((e) => {
      if (!e.video_url) return;
      exerciseVideos[e.id] = e.video_url;
      if (e.name_ar) exerciseVideos[e.name_ar] = e.video_url;
    });
  } catch (error) {
    console.error("Failed to fetch data for admin library:", error);
  }

  /* A fragment because this page returns the client component bare — there is
     no wrapper here to hang it inside, and adding one would change the layout
     for the sake of a component that renders nothing. */
  return (
    <>
      <LiveRefresh scope="panel" />
      <AdminCoursesClient
        initialCourses={courses}
        initialTrainees={trainees}
        initialAssignments={assignments}
        exerciseVideos={exerciseVideos}
      />
    </>
  );
}
