import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/authGuard";
import LiveRefresh from "@/components/LiveRefresh";
import DietLibraryClient, { type LibraryPlan } from "./DietLibraryClient";
import { asMeals } from "@/types/diet";
import type { TraineeOption } from "@/types/admin";

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

export default async function DietLibraryPage() {
  /* The proxy already turned strangers away before this rendered — but a
     matcher is a list of paths, and this page reads every subscriber's diet.
     It proves the caller for itself rather than inheriting the answer.
     See @/lib/authGuard. */
  await requireAdminPage();

  let plans: LibraryPlan[] = [];
  let trainees: TraineeOption[] = [];

  try {
    /* Every plan there is, each with the name of whoever it was written for —
       or none, for a general plan. `profile_id` was NOT NULL until
       2026-09-06-general-diet-plans.sql; a null owner now means a plan the
       coach wrote before deciding who it is for, the diet side of a course
       saved with nobody on it. Both kinds live in this one list, which is the
       point of it. */
    const rows = await prisma.diet_plans.findMany({
      orderBy: [{ created_at: "desc" }, { position: "asc" }],
      select: {
        id: true,
        name: true,
        position: true,
        group_id: true,
        meals_data: true,
        created_at: true,
        updated_at: true,
        profiles: { select: { id: true, username: true, data: true } },
      },
    });

    /* `profiles.data` is read here and goes no further: it holds phone numbers,
       health history and body-photo URLs, and all this list needs out of it is
       a name to print on a card. Same rule the plan builder and the course
       builder each state where they map their own trainee lists. */
    /* A card is a document, and a general template is one document with two
       alternatives inside it — so its rows are folded together here by the
       group that makes them alternatives of each other. A prescribed plan stays
       one card per row: those two are two prescriptions the coach wrote for one
       person on different days, not one thing authored in a single sitting.
       `byGroup` keeps insertion order, so the ordering of the query above
       survives the fold. */
    const byGroup = new Map<string, LibraryPlan>();

    for (const row of rows) {
      const owner = row.profiles;
      const data = parseData(owner?.data);
      const fullname = typeof data.fullname === "string" ? data.fullname : "";
      const choice = {
        id: row.id,
        name: row.name,
        position: row.position,
        meals: asMeals(row.meals_data),
      };

      /* Rows written before 2026-09-06-general-diet-plan-choices.sql carry no
         group, so an ownerless one stands alone under its own id — the same
         card it was before the column existed. */
      const groupKey = !owner && row.group_id ? row.group_id : "";

      if (groupKey) {
        const existing = byGroup.get(groupKey);
        if (existing) {
          existing.choices.push(choice);
          /* The card is dated by the newest thing in it, and named by the first
             choice — the rows arrive newest-first, so only a lower position may
             rename it. */
          if (row.updated_at.toISOString() > existing.updated_at) {
            existing.updated_at = row.updated_at.toISOString();
          }
          existing.choices.sort((a, b) => a.position - b.position);
          existing.name = existing.choices[0].name;
          continue;
        }
      }

      byGroup.set(groupKey || row.id, {
        key: groupKey || row.id,
        name: row.name,
        choices: [choice],
        created_at: row.created_at.toISOString(),
        updated_at: row.updated_at.toISOString(),
        /* Empty strings rather than nulls, so the client has one shape to
           render and `ownerId` stays the thing every link is built from. A
           general template is exactly the card where they are empty. */
        ownerId: owner?.id ?? "",
        ownerName: owner ? fullname || owner.username : "",
        ownerUsername: owner?.username ?? "",
        groupId: groupKey,
        position: row.position,
      });
    }

    plans = [...byGroup.values()];

    const profileRows = await prisma.profiles.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, username: true, data: true },
    });
    trainees = profileRows.map((p) => {
      const data = parseData(p.data);
      const fullname = typeof data.fullname === "string" ? data.fullname : "";
      return { id: p.id, name: fullname || p.username, username: p.username };
    });
  } catch (error) {
    console.error("Failed to fetch data for the diet library:", error);
  }

  /* A fragment because the client component brings its own page shell, exactly
     as the course library's page does. */
  return (
    <>
      {/* The panel fingerprint in /api/live already folds in diet_plans' count
          and max(updated_at), so a plan saved in another tab reaches this list
          without anything being added there. Safe on this screen for the reason
          LiveRefresh's own note gives: nothing here is composed, so a refresh
          arriving mid-read costs nothing — the search box and any open dialog
          survive it. */}
      <LiveRefresh scope="panel" />
      <DietLibraryClient initialPlans={plans} initialTrainees={trainees} />
    </>
  );
}
