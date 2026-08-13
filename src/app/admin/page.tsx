import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import AdminCRMClient from "./AdminCRMClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  /* The account row carries the current username; the profile row can hold a
     stale copy of it, so the list reads through the relation. */
  let profiles: Prisma.profilesGetPayload<{ include: { accounts: true } }>[] = [];
  
  try {
    profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
      include: { accounts: true },
    });
  } catch (error) {
    console.error("Failed to fetch profiles for admin CRM:", error);
  }

  // Pass JSON serializable profiles
  const serializedProfiles = profiles.map(p => ({
    id: p.id,
    username: p.accounts?.username || p.username,
    created_at: p.created_at.toISOString(),
    data: p.data || {},
    // Authoritative flag, from the column rather than the JSON blob.
    is_suspended: p.is_suspended,
  }));

  return <AdminCRMClient initialProfiles={serializedProfiles} />;
}
