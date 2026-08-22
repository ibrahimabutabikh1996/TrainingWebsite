import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import AdminCoursesClient from "./AdminCoursesClient";
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
  } catch (error) {
    console.error("Failed to fetch data for admin library:", error);
  }

  return (
    <AdminCoursesClient
      initialCourses={courses}
      initialTrainees={trainees}
      initialAssignments={assignments}
    />
  );
}
