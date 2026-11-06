"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createdBy, requireAdminAction, sessionMadeIt, sessionMaySeeTrainee } from "@/lib/authGuard";
import { isMissingTable } from "./data";

/* The challenges screen's writes. A server action is a public endpoint, so each
 * one checks the caller and every field again, whatever the form allowed.
 *
 * The coach may do everything. A staff member needs "challenges.edit"; they may
 * change only the challenges they made, and review only the submissions of the
 * trainees the coach gave them. */

type Result = { success: true } | { success: false; error: string };

const DENIED = { success: false as const, error: "غير مصرح لك بهذا الإجراء" };
const NO_TABLES = {
  success: false as const,
  error: "جداول التحديات غير موجودة بعد — شغّل ملف prisma/manual/2026-11-04-challenges.sql في Supabase",
};

function failure(error: unknown, fallback: string): { success: false; error: string } {
  if (isMissingTable(error)) return NO_TABLES;
  console.error(`[challenges] ${fallback}:`, error);
  return { success: false, error: fallback };
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const isUUID = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* The form sends a calendar day. A start date opens at the beginning of that day
   and an end date closes at its end, both in Baghdad time — the coach's day, not
   the server's. */
function dayBoundary(value: unknown, edge: "start" | "end"): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "invalid";
  const d = new Date(`${value}T${edge === "start" ? "00:00:00" : "23:59:59"}+03:00`);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

function revalidate() {
  revalidatePath("/admin/challenges");
  revalidatePath("/admin");
}

/* ------------------------------------------------------------------ *
 * Challenges
 * ------------------------------------------------------------------ */

export interface ChallengeInput {
  id?: string | null;
  title: string;
  description: string;
  target: string;
  points: number;
  video_url: string;
  /** "YYYY-MM-DD" or "". */
  starts_on: string;
  ends_on: string;
  is_active: boolean;
}

export async function saveChallenge(input: ChallengeInput): Promise<Result> {
  const session = await requireAdminAction("challenges.edit");
  if (!session) return DENIED;

  const title = text(input?.title, 120);
  if (title.length < 2) return { success: false, error: "اكتب اسم التحدي" };

  const points = Math.round(Number(input?.points));
  if (!Number.isFinite(points) || points < 0 || points > 10000) {
    return { success: false, error: "النقاط يجب أن تكون رقماً بين 0 و 10000" };
  }

  const videoUrl = text(input?.video_url, 500);
  if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
    return { success: false, error: "رابط الفيديو يجب أن يبدأ بـ https://" };
  }

  const startsAt = dayBoundary(input?.starts_on, "start");
  const endsAt = dayBoundary(input?.ends_on, "end");
  if (startsAt === "invalid" || endsAt === "invalid") return { success: false, error: "التاريخ غير صحيح" };
  if (startsAt && endsAt && endsAt < startsAt) {
    return { success: false, error: "تاريخ النهاية قبل تاريخ البداية" };
  }

  const data = {
    title,
    description: text(input?.description, 2000),
    target: text(input?.target, 120),
    points,
    video_url: videoUrl || null,
    starts_at: startsAt,
    ends_at: endsAt,
    is_active: input?.is_active !== false,
  };

  try {
    if (input?.id) {
      if (!isUUID(input.id)) return { success: false, error: "معرّف غير صالح" };
      const existing = await prisma.challenges.findUnique({ where: { id: input.id }, select: { created_by: true } });
      if (!existing) return { success: false, error: "التحدي غير موجود" };
      if (!sessionMadeIt(session, existing.created_by)) return DENIED;
      await prisma.challenges.update({ where: { id: input.id }, data });
    } else {
      await prisma.challenges.create({ data: { ...data, ...createdBy(session) } });
    }
    revalidate();
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر حفظ التحدي");
  }
}

export async function setChallengeActive(id: string, isActive: boolean): Promise<Result> {
  const session = await requireAdminAction("challenges.edit");
  if (!session) return DENIED;
  if (!isUUID(id)) return { success: false, error: "معرّف غير صالح" };

  try {
    const existing = await prisma.challenges.findUnique({ where: { id }, select: { created_by: true } });
    if (!existing) return { success: false, error: "التحدي غير موجود" };
    if (!sessionMadeIt(session, existing.created_by)) return DENIED;
    await prisma.challenges.update({ where: { id }, data: { is_active: isActive === true } });
    revalidate();
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر تحديث التحدي");
  }
}

/* Deleting a challenge deletes its submissions with it — and with them the
   points the trainees earned. So a challenge anyone has been approved on cannot
   be deleted, only stopped: stopping hides it from new submissions and keeps
   every point where it is. */
export async function deleteChallenge(id: string): Promise<Result> {
  const session = await requireAdminAction("challenges.edit");
  if (!session) return DENIED;
  if (!isUUID(id)) return { success: false, error: "معرّف غير صالح" };

  try {
    const existing = await prisma.challenges.findUnique({ where: { id }, select: { created_by: true } });
    if (!existing) return { success: false, error: "التحدي غير موجود" };
    if (!sessionMadeIt(session, existing.created_by)) return DENIED;

    const approved = await prisma.challenge_submissions.count({ where: { challenge_id: id, status: "approved" } });
    if (approved > 0) {
      return {
        success: false,
        error: `لا يمكن حذف تحدٍ أتمّه ${approved} لاعب — حذفه يمسح نقاطهم. أوقفه بدلاً من ذلك.`,
      };
    }
    await prisma.challenges.delete({ where: { id } });
    revalidate();
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر حذف التحدي");
  }
}

/* ------------------------------------------------------------------ *
 * Review
 * ------------------------------------------------------------------ */

export type ReviewDecision = "approve" | "reject" | "reset";

/**
 * The coach's verdict on one submission.
 *
 *   approve  the video was right: the challenge's points are copied onto the row
 *   reject   it was not: no points, and the reason is shown to the trainee, who
 *            may try again
 *   reset    undo either, back to pending — for a button pressed by mistake
 */
export async function reviewSubmission(id: string, decision: ReviewDecision, reason?: string): Promise<Result> {
  const session = await requireAdminAction("challenges.edit");
  if (!session) return DENIED;
  if (!isUUID(id)) return { success: false, error: "معرّف غير صالح" };
  if (decision !== "approve" && decision !== "reject" && decision !== "reset") {
    return { success: false, error: "إجراء غير معروف" };
  }

  try {
    const row = await prisma.challenge_submissions.findUnique({
      where: { id },
      select: { profile_id: true, status: true, challenge: { select: { points: true } } },
    });
    if (!row || !sessionMaySeeTrainee(session, row.profile_id)) {
      return { success: false, error: "الطلب غير موجود" };
    }

    const reviewer = session.username;
    if (decision === "approve") {
      if (row.status === "approved") return { success: true };
      await prisma.challenge_submissions.update({
        where: { id },
        data: {
          status: "approved",
          points_awarded: row.challenge.points,
          reject_reason: null,
          reviewed_at: new Date(),
          reviewed_by_name: reviewer,
        },
      });
    } else if (decision === "reject") {
      await prisma.challenge_submissions.update({
        where: { id },
        data: {
          status: "rejected",
          points_awarded: 0,
          reject_reason: text(reason, 300) || null,
          reviewed_at: new Date(),
          reviewed_by_name: reviewer,
        },
      });
    } else {
      await prisma.challenge_submissions.update({
        where: { id },
        data: { status: "pending", points_awarded: 0, reject_reason: null, reviewed_at: null, reviewed_by_name: null },
      });
    }
    revalidate();
    return { success: true };
  } catch (error) {
    return failure(error, "تعذّر حفظ المراجعة");
  }
}
