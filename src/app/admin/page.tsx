import { prisma } from "@/lib/db";
import AdminCRMClient from "./AdminCRMClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let profiles: Awaited<ReturnType<typeof prisma.profiles.findMany>> = [];
  
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
    // Authoritative flag, from the column rather than the JSON blob.
    is_suspended: p.is_suspended,
  }));

  return <AdminCRMClient initialProfiles={serializedProfiles} />;
}
