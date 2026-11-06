import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isMissingTable as isMissingStoreTable } from "@/lib/store/catalog";
import { traineeScope, type Session } from "@/lib/authGuard";
import {
  isSubmissionStatus,
  traineeWhatsAppDigits,
  type Challenge,
  type LeaderboardRow,
  type SubmissionRow,
} from "@/lib/challenges";

/** The challenge tables are not there yet. Raw queries through the pg adapter
    report it in the message rather than as a Prisma code, hence the second test. */
export function isMissingTable(error: unknown): boolean {
  if (isMissingStoreTable(error)) return true;
  const text = error instanceof Error ? error.message : String(error ?? "");
  return /challenge(_submissions|s)?\b.*does not exist|TableDoesNotExist/i.test(text);
}

/* Reads for the challenges screen. Each returns null when the tables are not
   there yet, so the screen can say "run the SQL file" instead of failing. */

type ChallengeRow = Awaited<ReturnType<typeof prisma.challenges.findMany>>[number];

export function toChallenge(r: ChallengeRow): Challenge {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    target: r.target,
    points: r.points,
    video_url: r.video_url,
    starts_at: r.starts_at?.toISOString() ?? null,
    ends_at: r.ends_at?.toISOString() ?? null,
    is_active: r.is_active,
    created_by: r.created_by,
    created_by_name: r.created_by_name,
    created_at: r.created_at.toISOString(),
  };
}

export async function getChallenges(): Promise<Challenge[] | null> {
  try {
    const rows = await prisma.challenges.findMany({ orderBy: { created_at: "desc" } });
    return rows.map(toChallenge);
  } catch (error) {
    if (!isMissingTable(error)) console.error("[challenges] Failed to read challenges:", error);
    return null;
  }
}

/* The trainee's name and phone are read out of the intake blob in Postgres, so
   the rest of the record — measurements, health answers, monthly history —
   never leaves the database for a list that shows a name. */
type RawSubmission = {
  id: string;
  challenge_id: string;
  challenge_title: string;
  challenge_target: string;
  challenge_points: number;
  profile_id: string;
  fullname: string | null;
  phone: string | null;
  username: string;
  reference: string;
  status: string;
  points_awarded: number;
  reject_reason: string | null;
  submitted_at: Date;
  reviewed_at: Date | null;
  reviewed_by_name: string | null;
};

function toRow(r: RawSubmission): SubmissionRow {
  return {
    id: r.id,
    challenge_id: r.challenge_id,
    challenge_title: r.challenge_title,
    challenge_target: r.challenge_target,
    challenge_points: r.challenge_points,
    profile_id: r.profile_id,
    trainee_name: r.fullname || r.username,
    trainee_phone: traineeWhatsAppDigits(r.phone),
    reference: r.reference,
    status: isSubmissionStatus(r.status) ? r.status : "pending",
    points_awarded: r.points_awarded,
    reject_reason: r.reject_reason,
    submitted_at: r.submitted_at.toISOString(),
    reviewed_at: r.reviewed_at?.toISOString() ?? null,
    reviewed_by_name: r.reviewed_by_name,
  };
}

/**
 * Submissions this session may see, newest first: every one for the coach, a
 * staff member's own trainees only otherwise.
 */
export async function getSubmissions(session: Session, limit = 500): Promise<SubmissionRow[] | null> {
  const ids = traineeScope(session).id?.in;
  if (ids && ids.length === 0) return [];
  try {
    const rows = await prisma.$queryRaw<RawSubmission[]>`
      SELECT
        s.id, s.challenge_id, c.title AS challenge_title, c.target AS challenge_target,
        c.points AS challenge_points, s.profile_id,
        CASE WHEN jsonb_typeof(p.data) = 'object' THEN p.data->>'fullname' END AS fullname,
        CASE WHEN jsonb_typeof(p.data) = 'object' THEN p.data->>'phone' END AS phone,
        p.username, s.reference, s.status, s.points_awarded, s.reject_reason,
        s.submitted_at, s.reviewed_at, s.reviewed_by_name
      FROM public.challenge_submissions s
      JOIN public.challenges c ON c.id = s.challenge_id
      JOIN public.profiles p ON p.id = s.profile_id
      WHERE ${ids ? Prisma.sql`s.profile_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.sql`TRUE`}
      ORDER BY (s.status = 'pending') DESC, s.submitted_at DESC
      LIMIT ${limit}
    `;
    return rows.map(toRow);
  } catch (error) {
    if (!isMissingTable(error)) console.error("[challenges] Failed to read submissions:", error);
    return null;
  }
}

/** Points per trainee, from the approved submissions, highest first. */
export function leaderboardOf(rows: SubmissionRow[]): LeaderboardRow[] {
  const by = new Map<string, LeaderboardRow>();
  for (const r of rows) {
    if (r.status !== "approved") continue;
    const entry = by.get(r.profile_id) ?? { profile_id: r.profile_id, trainee_name: r.trainee_name, points: 0, completed: 0 };
    entry.points += r.points_awarded;
    entry.completed += 1;
    by.set(r.profile_id, entry);
  }
  return [...by.values()].sort((a, b) => b.points - a.points || b.completed - a.completed);
}

/** How many submissions are waiting on this session — the nav badge and the bell. */
export async function pendingCount(session: Session): Promise<number> {
  const ids = traineeScope(session).id?.in;
  if (ids && ids.length === 0) return 0;
  try {
    return await prisma.challenge_submissions.count({
      where: { status: "pending", ...(ids ? { profile_id: { in: ids } } : {}) },
    });
  } catch (error) {
    if (!isMissingTable(error)) console.error("[challenges] Failed to count pending:", error);
    return 0;
  }
}
