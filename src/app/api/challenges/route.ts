import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownProfileId, requireUser } from "@/lib/authGuard";
import { clientAddress, consumeAttempt } from "@/lib/rateLimit";
import { getStoreSettings } from "@/lib/store/catalog";
import { isMissingTable } from "@/app/admin/challenges/data";
import {
  challengeIsOpen,
  isChallengeReference,
  isSubmissionStatus,
  type TraineeChallenge,
  type TraineeChallengesResponse,
} from "@/lib/challenges";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* The trainee's side of challenges.
 *
 *   GET   the open challenges, plus any the trainee has already sent, each with
 *         their own submission; their points; and the coach's WhatsApp number
 *   POST  "I did it": records a pending submission. The browser has already
 *         opened WhatsApp with the video message by the time this answers — a
 *         window opened after an awaited request is one a browser may block —
 *         so this is the panel's record of it, and the coach's queue.
 *
 * Points are never taken from the browser. They are copied from the challenge
 * when the coach approves, in /admin/challenges. */

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/* Twenty in a window is far more than any trainee presses on purpose, and few
   enough that a script cannot fill the coach's queue. */
const SUBMIT_LIMIT = { max: 20, windowMinutes: 15 };

const isUUID = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const profileId = await ownProfileId(auth.session);
  if (!profileId) return NextResponse.json({ error: "لم يتم العثور على الملف" }, { status: 404 });

  const settings = await getStoreSettings();

  /* Only the one key of the intake blob this needs, picked in Postgres. */
  const [who] = await prisma.$queryRaw<Array<{ fullname: string | null; username: string }>>`
    SELECT CASE WHEN jsonb_typeof(data) = 'object' THEN data->>'fullname' END AS fullname, username
    FROM public.profiles WHERE id = ${profileId}::uuid
  `;
  const fullname = who?.fullname || who?.username || "";

  const empty: TraineeChallengesResponse = {
    challenges: [],
    totalPoints: 0,
    whatsapp: settings.whatsapp,
    fullname,
  };

  try {
    const [challenges, mine] = await Promise.all([
      prisma.challenges.findMany({ orderBy: { created_at: "desc" } }),
      prisma.challenge_submissions.findMany({ where: { profile_id: profileId } }),
    ]);
    const mineBy = new Map(mine.map((s) => [s.challenge_id, s]));
    const now = new Date();

    const list: TraineeChallenge[] = challenges
      .map((c) => {
        const s = mineBy.get(c.id);
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          target: c.target,
          points: c.points,
          video_url: c.video_url,
          ends_at: c.ends_at?.toISOString() ?? null,
          is_open: challengeIsOpen(c, now),
          submission: s
            ? {
                status: isSubmissionStatus(s.status) ? s.status : "pending",
                reference: s.reference,
                points_awarded: s.points_awarded,
                reject_reason: s.reject_reason,
                submitted_at: s.submitted_at.toISOString(),
                reviewed_at: s.reviewed_at?.toISOString() ?? null,
              }
            : null,
        };
      })
      /* A closed challenge stays on the list only if the trainee took part in
         it — it is their record — and a stopped one they never touched is gone. */
      .filter((c) => c.is_open || c.submission !== null);

    const totalPoints = mine.reduce((sum, s) => sum + (s.status === "approved" ? s.points_awarded : 0), 0);

    return NextResponse.json({ ...empty, challenges: list, totalPoints } satisfies TraineeChallengesResponse, {
      headers: NO_STORE,
    });
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ ...empty, unavailable: true } satisfies TraineeChallengesResponse, { headers: NO_STORE });
    }
    console.error("[challenges] Failed to read trainee challenges:", error);
    return NextResponse.json({ error: "تعذّر تحميل التحديات" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  /* The coach and staff have no dashboard to submit from. */
  if (auth.session.isAdmin || auth.session.isStaff) {
    return NextResponse.json({ error: "هذه الخاصية للاعبين فقط" }, { status: 403 });
  }

  const limit = await consumeAttempt(`challenge-submit:${auth.session.userId}:${clientAddress(request)}`, SUBMIT_LIMIT);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "محاولات كثيرة، حاول بعد قليل" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const challengeId = body?.challengeId;
  const reference = body?.reference;
  if (!isUUID(challengeId) || !isChallengeReference(reference)) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const profileId = await ownProfileId(auth.session);
  if (!profileId) return NextResponse.json({ error: "لم يتم العثور على الملف" }, { status: 404 });

  try {
    const challenge = await prisma.challenges.findUnique({ where: { id: challengeId } });
    if (!challenge || !challengeIsOpen(challenge)) {
      return NextResponse.json({ error: "هذا التحدي غير متاح حالياً" }, { status: 409 });
    }

    const existing = await prisma.challenge_submissions.findUnique({
      where: { challenge_id_profile_id: { challenge_id: challengeId, profile_id: profileId } },
    });

    if (existing?.status === "approved") {
      return NextResponse.json({ error: "أتممت هذا التحدي مسبقاً" }, { status: 409 });
    }
    /* Already waiting: a second press changes nothing, and the reference the
       coach may already have in WhatsApp stays the one on record. */
    if (existing?.status === "pending") {
      return NextResponse.json({ ok: true, reference: existing.reference });
    }

    if (existing) {
      /* Rejected, trying again: the same row, back in the queue. */
      await prisma.challenge_submissions.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          reference,
          points_awarded: 0,
          reject_reason: null,
          submitted_at: new Date(),
          reviewed_at: null,
          reviewed_by_name: null,
        },
      });
    } else {
      await prisma.challenge_submissions.create({
        data: { challenge_id: challengeId, profile_id: profileId, reference },
      });
    }

    return NextResponse.json({ ok: true, reference });
  } catch (error) {
    if (isMissingTable(error)) {
      return NextResponse.json({ error: "التحديات غير مفعّلة بعد" }, { status: 503 });
    }
    /* Two presses landing together: the unique constraint let one through. */
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      const row = await prisma.challenge_submissions
        .findUnique({ where: { challenge_id_profile_id: { challenge_id: challengeId, profile_id: profileId } } })
        .catch(() => null);
      if (row) return NextResponse.json({ ok: true, reference: row.reference });
    }
    console.error("[challenges] Failed to record submission:", error);
    return NextResponse.json({ error: "تعذّر تسجيل الطلب، حاول مرة أخرى" }, { status: 500 });
  }
}
