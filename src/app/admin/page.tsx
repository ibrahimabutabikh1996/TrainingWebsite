import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import AdminCRMClient from "./AdminCRMClient";
import LiveRefresh from "@/components/LiveRefresh";
import type { JsonRecord } from "@/types";
import { getLandingContent } from "./cms/actions";
import { resolvePlanNames } from "@/lib/planNames";

export const dynamic = "force-dynamic";

/**
 * The intake fields the subscriber list actually draws.
 *
 * `data` is the whole intake record: injuries, allergies, diet history, the URLs
 * of the body photographs, every measurement — and `history`, which holds a full
 * copy of all of the above for each month the trainee has renewed. All of it was
 * being serialised into the page for every subscriber at once, to render a table
 * that reads seven keys.
 *
 * That is a payload that grows with each renewal of each trainee, and it puts a
 * person's health answers into the HTML of a page that is merely listing names.
 * The panel can still show any of it — the profile page fetches what it needs,
 * for one trainee, when the coach opens them.
 */
const LIST_FIELDS = [
  "fullname",
  "phone",
  "plan",
  "plan_type",
  "is_new",
  "is_renewal",
  /* One boolean, so the list can mark who is waiting on a decision. Without it
     a pending renewal was visible only after opening the trainee, which for a
     request that blocks a paid month is the wrong way round. */
  "renewal_pending",
  "activation_date",
] as const;

/** The blob as it is stored, or an empty record — the column is free-form. */
function readBlob(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function listFieldsOnly(value: unknown): JsonRecord {
  const blob = readBlob(value);
  const picked: JsonRecord = {};
  for (const key of LIST_FIELDS) {
    if (blob[key] !== undefined) picked[key] = blob[key];
  }
  return picked;
}

export default async function AdminDashboardPage() {
  /* The proxy already turned strangers away before this rendered — but a
     matcher is a list of paths, and this page reads every subscriber it can
     find. It proves the caller for itself rather than inheriting the answer.
     See @/lib/authGuard. */
  await requireAdminPage();

  /* The account row carries the current username; the profile row can hold a
     stale copy of it, so the list reads through the relation — but only that one
     column of it. `include: { accounts: true }` pulled the whole row, password
     hash included, to read a name. */
  let profiles: Array<{
    id: string;
    username: string;
    created_at: Date;
    data: unknown;
    is_suspended: boolean;
    accounts: { username: string } | null;
  }> = [];

  try {
    profiles = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        username: true,
        created_at: true,
        data: true,
        is_suspended: true,
        accounts: { select: { username: true } },
      },
    });
  } catch (error) {
    console.error("Failed to fetch profiles for admin CRM:", error);
  }

  // Pass JSON serializable profiles
  const serializedProfiles = profiles.map(p => ({
    id: p.id,
    username: p.accounts?.username || p.username,
    created_at: p.created_at.toISOString(),
    data: listFieldsOnly(p.data),
    // Authoritative flag, from the column rather than the JSON blob.
    is_suspended: p.is_suspended,
  }));

  /* The packages as the coach named them, so the subscriber list, its filter
     and the CSV it exports all say what the panel says. */
  const planNames = resolvePlanNames(
    (await getLandingContent())?.content_ar as JsonRecord | undefined
  );

  /* A fragment because this page returns the client component bare — there is
     no wrapper here to hang it inside, and adding one would change the layout
     for the sake of a component that renders nothing. */
  return (
    <>
      <LiveRefresh scope="panel" />
      <AdminCRMClient initialProfiles={serializedProfiles} planNames={planNames} />
    </>
  );
}
