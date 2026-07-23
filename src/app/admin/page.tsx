import { prisma } from "@/lib/db";
import AdminCRMClient from "./AdminCRMClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let profiles: any[] = [];
  
  try {
    profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch profiles for admin CRM:", error);
  }

  // Pass JSON serializable profiles
  const serializedProfiles = profiles.map(p => ({
    id: p.id,
    username: p.username,
    created_at: p.created_at.toISOString(),
    data: p.data || {},
  }));

  return <AdminCRMClient initialProfiles={serializedProfiles} />;
}
