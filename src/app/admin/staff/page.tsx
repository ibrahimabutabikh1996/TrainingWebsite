import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import AdminStaffClient, { type StaffMember } from "./AdminStaffClient";

export const dynamic = "force-dynamic";

/* The coach's list of staff. No permission is passed to the guard, so this
   screen is the coach's alone: a staff member who reaches it is sent to the
   first screen they were granted. */
export default async function AdminStaffPage() {
  await requireAdminPage();

  let staff: StaffMember[] = [];

  try {
    const rows = await prisma.staff_accounts.findMany({
      orderBy: { created_at: "asc" },
      select: {
        account_id: true,
        permissions: true,
        is_suspended: true,
        created_at: true,
        accounts: { select: { username: true } },
      },
    });
    staff = rows.map((row) => ({
      accountId: row.account_id,
      username: row.accounts.username,
      permissions: row.permissions,
      isSuspended: row.is_suspended,
      createdAt: row.created_at.toISOString(),
    }));
  } catch (error) {
    /* Most likely prisma/manual/2026-10-09-staff-permissions.sql has not been
       applied yet. The screen still renders, empty, rather than taking the
       panel down with it. */
    console.error("Failed to fetch staff:", error);
  }

  return <AdminStaffClient staff={staff} />;
}
