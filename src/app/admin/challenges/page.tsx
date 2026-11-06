import { requireAdminPage, sessionCan } from "@/lib/authGuard";
import LiveRefresh from "@/components/LiveRefresh";
import { getChallenges, getSubmissions, leaderboardOf } from "./data";
import ChallengesClient from "./ChallengesClient";

export const dynamic = "force-dynamic";

/* The coach's challenges: the ones set, the queue of trainees who say they did
   one, and the points table. A staff member needs the "challenges" grant, and
   sees only the submissions of the trainees the coach gave them. */
export default async function AdminChallengesPage() {
  const session = await requireAdminPage("challenges.view");

  const [challenges, submissions] = await Promise.all([getChallenges(), getSubmissions(session)]);

  return (
    <>
      <LiveRefresh scope="panel" />
      <ChallengesClient
        challenges={challenges ?? []}
        submissions={submissions ?? []}
        leaderboard={leaderboardOf(submissions ?? [])}
        tablesMissing={challenges === null || submissions === null}
        canEdit={sessionCan(session, "challenges.edit")}
        isOwner={session.isAdmin}
        userId={session.userId}
      />
    </>
  );
}
