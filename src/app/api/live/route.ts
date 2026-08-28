import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, sessionOwnsProfile } from "@/lib/authGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/live?scope=…  — has anything changed?
 *
 * The signal behind every self-updating page in the panel. It answers with a
 * fingerprint and nothing else:
 *
 *   { "v": "8f3c1a…" }
 *
 * That is the whole security design. The response carries no weight, no name,
 * no date and no id — a hash of them. A caller who is allowed to ask learns
 * only *that* something moved, and then re-reads through the page's own
 * authorised path, which is where the data has always been checked. A caller
 * who is not allowed to ask is refused here.
 *
 * Why a hash rather than a timestamp: `profiles` has no `updated_at` column and
 * adding one means a migration and a trigger on the table the whole product
 * reads. A fingerprint over the fields that matter needs neither, and it is
 * exact — a value edited back to what it was reads as no change, which is what
 * it is.
 *
 * Why polling rather than a socket: this app authenticates with its own signed
 * cookie, not Supabase Auth, so Postgres cannot tell who the browser is. Every
 * table is RLS-on with no policies — deny-all — which is why the public anon key
 * in the bundle can read nothing today. Serving realtime to that key would mean
 * writing policies that cannot scope to a person, i.e. opening every trainee's
 * row to anyone holding a key that ships in the JavaScript. Verified, not
 * assumed: six tables checked, `relrowsecurity = true`, zero rows in
 * `pg_policies`. Seconds of latency is the price of not doing that.
 */

const isValidUUID = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** The unchanging answer for "you may not ask", so a refusal costs no query. */
const DENIED = NextResponse.json({ error: "غير مصرح" }, { status: 403 });

/* Everything about one trainee that another screen might be waiting on: their
   record (which carries the weekly weights, the renewals and the intake
   answers), which programme and cycle they are on, what they have logged, and
   the diets prescribed to them. Aggregates rather than rows — the point is to
   notice a change, not to describe it. */
async function profileFingerprint(profileId: string): Promise<string> {
  /* One statement, and the trainee's record never leaves Postgres.
   *
   * This was four queries in a `Promise.all` — concurrent on a machine with
   * spare connections, and strictly serial on Vercel, where `DATABASE_POOL_MAX`
   * is 1 by design. Four round trips every five seconds, per open tab.
   *
   * The `data` column was the worse half. It was *selected* so that Node could
   * hash it: the whole intake record, every archived month inside `history`,
   * across the wire on every poll, to produce forty hex characters. `md5()` in
   * Postgres produces the same answer from the same bytes without moving them.
   *
   * `::text` on a jsonb column renders it in a normalised form, so the digest
   * is stable for a value that has not changed — which is the only property
   * this needs. It is a change-detector, not a checksum anyone verifies. */
  const [row] = await prisma.$queryRaw<Array<{ fp: string | null }>>`
    SELECT
      md5(
        COALESCE(md5(p.data::text), '') || ':' ||
        COALESCE(p.current_course_id::text, '') || ':' ||
        COALESCE(p.subscription_ends_at::text, '') || ':' ||
        p.is_suspended::text || ':' ||
        /* logged_at, not session_date: the first is when the row was written,
           the second is the day being recorded and can be backdated. A set
           corrected an hour later changes neither the count nor the date. */
        (SELECT count(*)::text || ':' || COALESCE(max(logged_at)::text, '')
           FROM public.workout_logs WHERE profile_id = p.id) || ':' ||
        (SELECT count(*)::text || ':' || COALESCE(max(created_at)::text, '')
                || ':' || COALESCE(max(completed_at)::text, '')
           FROM public.training_cycles WHERE profile_id = p.id) || ':' ||
        (SELECT count(*)::text || ':' || COALESCE(max(updated_at)::text, '')
           FROM public.diet_plans WHERE profile_id = p.id)
      ) AS fp
    FROM public.profiles p
    WHERE p.id = ${profileId}::uuid
  `;

  /* No row means the profile is gone — answered as its own constant so the
     caller's poller sees a change rather than an error. */
  if (!row?.fp) return "absent";
  return row.fp.slice(0, 16);
}

/* The coach's own screens: the subscriber list, the libraries, the content the
   site is built from. Counts and high-water marks only. */
async function panelFingerprint(): Promise<string> {
  /* Six aggregates and a full table read, folded into one statement.
   *
   * The read was the expensive part and the easiest to overlook: every
   * subscriber row, ordered, serialised to JSON in Node and hashed — to detect
   * that one of them had been suspended or had asked to renew. That is a cost
   * that grows with the subscriber list, paid every five seconds by every open
   * panel tab, and on Vercel it queued behind the six aggregates rather than
   * running beside them.
   *
   * `string_agg` with `ORDER BY` builds the same per-row digest inside
   * Postgres, and only the md5 comes back. A count alone would not do: a
   * renewal request or a suspension changes a row without changing any count,
   * which is why the rows were being read in the first place. */
  const [row] = await prisma.$queryRaw<Array<{ fp: string }>>`
    SELECT md5(
      (SELECT count(*)::text || ':' || COALESCE(max(created_at)::text, '')
         FROM public.profiles) || '|' ||
      (SELECT count(*)::text || ':' || COALESCE(max(created_at)::text, '')
         FROM public.courses) || '|' ||
      (SELECT count(*)::text FROM public.exercises) || '|' ||
      (SELECT count(*)::text FROM public.nutrition_sources) || '|' ||
      (SELECT count(*)::text || ':' || COALESCE(max(updated_at)::text, '')
         FROM public.diet_plans) || '|' ||
      (SELECT COALESCE(max(updated_at)::text, '') FROM public.site_settings) || '|' ||
      COALESCE((
        SELECT md5(string_agg(
          p.id::text || ':' ||
          COALESCE(p.current_course_id::text, '') || ':' ||
          COALESCE(p.subscription_ends_at::text, '') || ':' ||
          p.is_suspended::text,
          '|' ORDER BY p.id
        ))
        FROM public.profiles p
      ), '')
    ) AS fp
  `;

  return (row?.fp ?? "none").slice(0, 16);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "يجب تسجيل الدخول" }, { status: 401 });

  const scope = request.nextUrl.searchParams.get("scope") ?? "me";
  const id = request.nextUrl.searchParams.get("id");
  const admin = session.isAdmin;

  try {
    let v: string;

    if (scope === "panel") {
      /* The coach's own screens. A trainee asking for this is refused rather
         than quietly served their own scope — a wrong answer to a question the
         caller had no business asking is still an answer. */
      if (!admin) return DENIED;
      v = await panelFingerprint();
    } else if (scope === "profile") {
      if (!id || !isValidUUID(id)) {
        return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
      }
      /* The coach may watch any trainee; a trainee may watch only themselves,
         and `sessionOwnsProfile` is the same check every write path uses. */
      if (!admin && !(await sessionOwnsProfile(session, id))) return DENIED;
      v = await profileFingerprint(id);
    } else if (scope === "me") {
      const own = await prisma.profiles.findFirst({
        where: { user_id: session.userId },
        orderBy: { created_at: "desc" },
        select: { id: true },
      });
      v = own ? await profileFingerprint(own.id) : "none";
    } else {
      return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    }

    return NextResponse.json(
      { v },
      /* Never cached. A cached freshness check is a contradiction, and the CDN
         would happily serve one page's answer to another's poll. */
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("live fingerprint failed:", error);
    /* A failure here must never take a page down — the client treats a bad
       answer as "no news" and keeps showing what it has. */
    return NextResponse.json({ error: "تعذّر التحقق" }, { status: 500 });
  }
}
