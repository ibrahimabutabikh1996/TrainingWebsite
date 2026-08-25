import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
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

const fingerprint = (parts: unknown[]) =>
  crypto.createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 16);

/** The unchanging answer for "you may not ask", so a refusal costs no query. */
const DENIED = NextResponse.json({ error: "غير مصرح" }, { status: 403 });

/* Everything about one trainee that another screen might be waiting on: their
   record (which carries the weekly weights, the renewals and the intake
   answers), which programme and cycle they are on, what they have logged, and
   the diets prescribed to them. Aggregates rather than rows — the point is to
   notice a change, not to describe it. */
async function profileFingerprint(profileId: string): Promise<string> {
  const [profile, logs, cycles, diets] = await Promise.all([
    prisma.profiles.findUnique({
      where: { id: profileId },
      select: { data: true, current_course_id: true, subscription_ends_at: true, is_suspended: true },
    }),
    prisma.workout_logs.aggregate({
      where: { profile_id: profileId },
      _count: { _all: true },
      /* `logged_at`, not `session_date`: the first is when the row was written,
         the second is the day being recorded and can be backdated. A set
         corrected an hour later changes neither the count nor the date. */
      _max: { logged_at: true },
    }),
    prisma.training_cycles.aggregate({
      where: { profile_id: profileId },
      _count: { _all: true },
      _max: { created_at: true, completed_at: true },
    }),
    prisma.diet_plans.aggregate({
      where: { profile_id: profileId },
      _count: { _all: true },
      _max: { updated_at: true },
    }),
  ]);

  if (!profile) return "absent";

  /* `data` is hashed, not returned. It is the largest thing here and the one
     that changes most often — a weekly weight lands inside it. */
  return fingerprint([
    crypto.createHash("sha1").update(JSON.stringify(profile.data ?? null)).digest("hex"),
    profile.current_course_id,
    profile.subscription_ends_at,
    profile.is_suspended,
    logs._count._all, logs._max.logged_at,
    cycles._count._all, cycles._max.created_at, cycles._max.completed_at,
    diets._count._all, diets._max.updated_at,
  ]);
}

/* The coach's own screens: the subscriber list, the libraries, the content the
   site is built from. Counts and high-water marks only. */
async function panelFingerprint(): Promise<string> {
  const [profiles, courses, exercises, sources, diets, content] = await Promise.all([
    prisma.profiles.aggregate({ _count: { _all: true }, _max: { created_at: true } }),
    prisma.courses.aggregate({ _count: { _all: true }, _max: { created_at: true } }),
    prisma.exercises.aggregate({ _count: { _all: true } }),
    prisma.nutrition_sources.aggregate({ _count: { _all: true } }),
    prisma.diet_plans.aggregate({ _count: { _all: true }, _max: { updated_at: true } }),
    prisma.site_settings.aggregate({ _max: { updated_at: true } }),
  ]);

  /* A renewal request or a suspension changes a row without changing any count,
     so the subscriber rows carry their own digest. Narrow select: this is the
     panel's list view, and the list view already knows these fields. */
  const rows = await prisma.profiles.findMany({
    select: { id: true, current_course_id: true, subscription_ends_at: true, is_suspended: true },
    orderBy: { id: "asc" },
  });

  return fingerprint([
    profiles._count._all, profiles._max.created_at,
    courses._count._all, courses._max.created_at,
    exercises._count._all,
    sources._count._all,
    diets._count._all, diets._max.updated_at,
    content._max.updated_at,
    crypto.createHash("sha1").update(JSON.stringify(rows)).digest("hex"),
  ]);
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
