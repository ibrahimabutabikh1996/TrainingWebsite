import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import AdminStaffClient, { type StaffMember, type StaffTraineeOption } from "./AdminStaffClient";

export const dynamic = "force-dynamic";

/* The intake blob may be stored as a JSON string on older rows — the same
   reading the course and diet builders give it. */
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

/* The coach's list of staff. No permission is passed to the guard, so this
   screen is the coach's alone: a staff member who reaches it is sent to the
   first screen they were granted. */
export default async function AdminStaffPage() {
  await requireAdminPage();

  let staff: StaffMember[] = [];
  let trainees: StaffTraineeOption[] = [];

  try {
    const rows = await prisma.staff_accounts.findMany({
      orderBy: { created_at: "asc" },
      select: {
        account_id: true,
        permissions: true,
        is_suspended: true,
        created_at: true,
        accounts: { select: { username: true } },
        staff_trainees: { select: { profile_id: true } },
      },
    });
    staff = rows.map((row) => ({
      accountId: row.account_id,
      username: row.accounts.username,
      permissions: row.permissions,
      isSuspended: row.is_suspended,
      createdAt: row.created_at.toISOString(),
      traineeIds: row.staff_trainees.map((t) => t.profile_id),
    }));

    /* Every trainee, for the picker that decides whom each staff member sees.
       Only an id and a name cross to the browser — the intake blob is read for
       the name and goes no further, the rule every other trainee list keeps. */
    const profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, username: true, data: true },
    });
    trainees = profiles.map((p) => {
      const data = parseData(p.data);
      const fullname = typeof data.fullname === "string" ? data.fullname : "";
      return { id: p.id, name: fullname || p.username, username: p.username };
    });
  } catch (error) {
    /* Most likely prisma/manual/2026-10-09-staff-permissions.sql has not been
       applied yet. The screen still renders, empty, rather than taking the
       panel down with it. */
    console.error("Failed to fetch staff:", error);
  }

  return <AdminStaffClient staff={staff} trainees={trainees} />;
}
