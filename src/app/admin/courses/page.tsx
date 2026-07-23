import { prisma } from "@/lib/db";
import AdminCoursesClient from "./AdminCoursesClient";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  let courses: any[] = [];
  let profiles: any[] = [];
  
  try {
    courses = await prisma.courses.findMany({
      orderBy: { created_at: "desc" },
    });
    profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch data for admin library:", error);
  }

  const serializedCourses = courses.map(c => ({
    id: c.id,
    name: c.name,
    days_data: c.days_data || [],
    created_at: c.created_at.toISOString(),
  }));

  const serializedProfiles = profiles.map(p => ({
    id: p.id,
    username: p.username,
    fullname: (typeof p.data === "string" ? JSON.parse(p.data) : p.data)?.fullname || p.username,
  }));

  return <AdminCoursesClient initialCourses={serializedCourses} initialProfiles={serializedProfiles} />;
}
