import "server-only";
import { prisma } from "@/lib/db";

/* Slowing down password guessing, on a platform with no memory between requests.
 *
 * The sign-in endpoint had no limit of any kind: an attacker could try the whole
 * of rockyou.txt against `admin` as fast as the network allowed, and nothing in
 * the app would notice or object.
 *
 * The counter lives in Postgres rather than in the process. On Vercel each
 * request may land in a different instance, so anything held in memory is
 * counting a fraction of the attempts and enforcing a fraction of the limit —
 * which is the same as no limit at all, only harder to notice.
 *
 * The window is fixed rather than sliding: one row per key, reset when it ages
 * out. A sliding window would be more precise and would cost a row per attempt;
 * for turning thousands of guesses per minute into a handful, precision is not
 * what matters.
 *
 * ── What happens when the counter itself fails ───────────────────────────────
 *
 * Before `public.login_attempts` existed this module was plainly fail-open: any
 * error, log a line, let the request through. That was right while the table was
 * pending and wrong once it exists — a database blip would silently return the
 * endpoint to having no protection at all.
 *
 * It now degrades instead of surrendering. A failed counter falls back to an
 * in-process one for the duration of the outage: it only sees the requests that
 * reach this instance, so its limit is deliberately stricter, and it is not a
 * substitute for the shared counter — it is what stands in while the shared one
 * is unavailable. Every fall-back is logged with a fixed marker so it can be
 * alerted on rather than discovered later.
 *
 * Still not fail-closed: refusing every sign-in because the counter is unwell
 * locks out every real user to inconvenience an attacker who can simply wait,
 * and the password check behind this has to pass regardless.
 */

/** Attempts allowed per key before the shared window closes. */
const MAX_ATTEMPTS = 8;

/** How long a window lasts, and therefore how long a lockout lasts. */
const WINDOW_MINUTES = 15;

/** Stricter, because an instance-local counter sees only part of the traffic. */
const DEGRADED_MAX_ATTEMPTS = 3;

export interface RateLimitOptions {
  /** Attempts allowed in one window. Defaults to the sign-in limit. */
  max?: number;
  /** Window length in minutes. Defaults to the sign-in window. */
  windowMinutes?: number;
}

/* The upload endpoints share this counter. Anonymous visitors can ask for an
   upload session before they have an account, so those two are the ones that
   need a ceiling most — without one, a stranger can mint signed upload URLs
   until the bucket is full. */
export const UPLOAD_SESSION_LIMIT: RateLimitOptions = { max: 6, windowMinutes: 15 };
export const UPLOAD_SLOT_LIMIT: RateLimitOptions = { max: 60, windowMinutes: 15 };

/* The intake form. Submitting it creates an account, a profile and a mail, so it
   is the most expensive thing an anonymous caller can ask for. Five in a window
   leaves room for a genuine retry after a validation error — or for a household
   registering together — without leaving the table open to being filled. */
export const SUBMIT_FORM_LIMIT: RateLimitOptions = { max: 5, windowMinutes: 15 };

/* ------------------------------------------------------------------ *
 * The second dimension
 * ------------------------------------------------------------------ *
 *
 * Every limit above is keyed on `clientAddress`, and that address comes from
 * `x-forwarded-for` — a header the caller writes. Behind a proxy that overwrites
 * it the value is trustworthy; reached directly it is whatever the sender typed.
 * Rotating it was demonstrated to walk straight through all three ceilings, so
 * an address-only limit is a limit an attacker opts out of.
 *
 * The address stays — it is the right key for the ordinary case, and taking it
 * away would punish everyone behind one NAT. What changes is that it is no
 * longer *alone*: each endpoint also counts against something the caller cannot
 * choose, and both have to allow the request. `/api/auth/login` has always done
 * this (address AND submitted username); these are the endpoints that did not.
 *
 * What each one has to count against:
 *
 *   renewal            `profiles.id`, after the session has been verified and
 *                      ownership checked. Server-derived; unforgeable.
 *
 *   registration       `upload_sessions.id`. A registration cannot succeed
 *                      without a payment receipt, a receipt cannot exist without
 *                      a confirmed upload item, and that item cannot exist
 *                      without a session the server minted. So the anonymous
 *                      caller does have a server-issued identity by the time it
 *                      reaches the form — it just was not being counted.
 *
 *   opening a session  nothing. This is the one place with no identity yet, by
 *                      construction, and inventing a stable one for an anonymous
 *                      visitor is not possible without fingerprinting them. It
 *                      gets a process-wide ceiling instead — see below.
 */

/** Per profile, for a renewal. Generous: a genuine retry after a validation error. */
export const SUBMIT_FORM_RENEWAL_LIMIT: RateLimitOptions = { max: 5, windowMinutes: 15 };

/** Per upload session, for a registration. A session is single-use anyway. */
export const SUBMIT_FORM_SESSION_LIMIT: RateLimitOptions = { max: 5, windowMinutes: 15 };

/** Per upload session. `issueSlot` already caps items per session; this caps the asking. */
export const UPLOAD_SLOT_SESSION_LIMIT: RateLimitOptions = { max: 60, windowMinutes: 15 };

/**
 * Confirming an uploaded object.
 *
 * The only endpoint in the upload chain that had no ceiling at all, and the one
 * that does the most work per call: it downloads the stored object to read its
 * real size and leading bytes. Generous, because a session may hold up to
 * `MAX_ITEMS_PER_SESSION` files and each is confirmed once — this is a ceiling
 * on repetition, not on ordinary use.
 */
export const UPLOAD_CONFIRM_LIMIT: RateLimitOptions = { max: 60, windowMinutes: 15 };

/**
 * The backstop for opening an anonymous upload session — counted across every
 * caller at once, not per address.
 *
 * This is the only ceiling here that a rotating address cannot slip under,
 * because it does not look at the address at all. It is deliberately far above
 * any real traffic this site sees: a registration needs one session, and two
 * hundred registrations in a quarter of an hour is not something that happens.
 *
 * The cost is real and worth stating plainly: an attacker who burns this budget
 * denies new registrations to everyone until the window rolls. That is a worse
 * failure than throttling one address and a much better one than the alternative
 * it replaces, which was no effective ceiling at all — sessions minted until the
 * table or the bucket gave out. A fifteen-minute outage of sign-ups is
 * recoverable; an exhausted project is not. See finding N-10.
 */
export const UPLOAD_SESSION_GLOBAL_LIMIT: RateLimitOptions = { max: 200, windowMinutes: 15 };

/** The key that backstop counts against. Fixed on purpose — it is process-wide. */
export const UPLOAD_SESSION_GLOBAL_KEY = "upload-session:global";

/** Greppable in logs, stable across refactors — alert on this string. */
const DEGRADED_MARKER = "[rateLimit][DEGRADED]";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets. Only meaningful when `allowed` is false. */
  retryAfterSeconds: number;
  /** True when the shared counter was unavailable and the local one answered. */
  degraded: boolean;
}

function isMissingTable(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  /* Postgres: undefined_table. Prisma surfaces raw-query errors with the
     driver's own SQLSTATE. */
  return code === "42P01";
}

/* ------------------------------------------------------------------ *
 * The fallback counter
 * ------------------------------------------------------------------ */

interface LocalEntry {
  attempts: number;
  windowStartMs: number;
}

/* Bounded, so a flood of distinct keys during an outage cannot grow without
   limit. Oldest windows are dropped first — they are the ones closest to
   expiring anyway. */
const LOCAL_MAX_KEYS = 5_000;
const localCounters = new Map<string, LocalEntry>();

function consumeLocally(key: string, max: number, windowMinutes: number): RateLimitResult {
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();
  const existing = localCounters.get(key);

  const entry: LocalEntry =
    existing && now - existing.windowStartMs < windowMs
      ? { attempts: existing.attempts + 1, windowStartMs: existing.windowStartMs }
      : { attempts: 1, windowStartMs: now };

  localCounters.set(key, entry);

  if (localCounters.size > LOCAL_MAX_KEYS) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of localCounters) {
      if (v.windowStartMs < oldestAt) {
        oldestAt = v.windowStartMs;
        oldestKey = k;
      }
    }
    if (oldestKey !== null) localCounters.delete(oldestKey);
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((entry.windowStartMs + windowMs - now) / 1000)
  );

  /* Never looser than the shared limit it is standing in for: an endpoint with a
     generous ceiling should not become more permissive because the counter is
     degraded. */
  return {
    allowed: entry.attempts <= Math.min(DEGRADED_MAX_ATTEMPTS, max),
    retryAfterSeconds,
    degraded: true,
  };
}

/* ------------------------------------------------------------------ *
 * The shared counter
 * ------------------------------------------------------------------ */

/**
 * Counts one attempt against `key` and says whether it may proceed.
 *
 * The same counter serves sign-in and the upload endpoints; only the ceiling and
 * the window differ, so they are parameters rather than three copies of this.
 */
export async function consumeAttempt(
  key: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const max = options.max ?? MAX_ATTEMPTS;
  const windowMinutes = options.windowMinutes ?? WINDOW_MINUTES;

  try {
    const rows = await prisma.$queryRaw<Array<{ attempts: number; expires_in: number }>>`
      INSERT INTO public.login_attempts (key, attempts, window_start)
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE
          WHEN public.login_attempts.window_start < now() - (${windowMinutes} * INTERVAL '1 minute')
          THEN 1
          ELSE public.login_attempts.attempts + 1
        END,
        window_start = CASE
          WHEN public.login_attempts.window_start < now() - (${windowMinutes} * INTERVAL '1 minute')
          THEN now()
          ELSE public.login_attempts.window_start
        END
      RETURNING
        attempts,
        CEIL(EXTRACT(EPOCH FROM (
          window_start + (${windowMinutes} * INTERVAL '1 minute') - now()
        )))::int AS expires_in`;

    const row = rows[0];
    if (!row) {
      /* An upsert that returns nothing means the statement did not do what it
         says it does — treat it as a counter failure, not as permission. */
      console.error(`${DEGRADED_MARKER} upsert returned no row; using the in-process counter`);
      return consumeLocally(key, max, windowMinutes);
    }

    if (row.attempts > max) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, row.expires_in),
        degraded: false,
      };
    }
    return { allowed: true, retryAfterSeconds: 0, degraded: false };
  } catch (error) {
    if (isMissingTable(error)) {
      /* The table is created by prisma/manual/2026-08-09-login-attempts.sql. If
         this appears, it was dropped or the deployment points at a database
         where it was never applied. */
      console.error(
        `${DEGRADED_MARKER} public.login_attempts is MISSING. ` +
          "Sign-in is falling back to a per-instance counter — apply " +
          "prisma/manual/2026-08-09-login-attempts.sql."
      );
    } else {
      console.error(
        `${DEGRADED_MARKER} shared counter unavailable, falling back to the ` +
          "in-process counter:",
        error
      );
    }
    return consumeLocally(key, max, windowMinutes);
  }
}

/**
 * Counts one attempt against several keys at once and answers with the strictest
 * of them.
 *
 * Every key is consumed, not just up to the first refusal: these are independent
 * ceilings, and a request that is over the per-profile limit still happened from
 * an address and should count there too. Otherwise the cheaper key becomes a way
 * to avoid incrementing the expensive one.
 *
 * `/api/auth/login` has done this by hand since it was written — address AND
 * username, both consumed, worst answer wins. This is that shape, named, so the
 * endpoints that were counting only an address can adopt it without each
 * growing its own copy.
 */
export async function consumeAttempts(
  entries: Array<{ key: string; options?: RateLimitOptions }>
): Promise<RateLimitResult> {
  if (entries.length === 0) {
    return { allowed: true, retryAfterSeconds: 0, degraded: false };
  }

  const results = await Promise.all(
    entries.map((e) => consumeAttempt(e.key, e.options ?? {}))
  );

  const refused = results.filter((r) => !r.allowed);
  return {
    allowed: refused.length === 0,
    /* The longest wait among the ceilings that refused — telling the caller to
       come back before the strictest one has reset is telling them to fail. */
    retryAfterSeconds: refused.reduce((max, r) => Math.max(max, r.retryAfterSeconds), 0),
    degraded: results.some((r) => r.degraded),
  };
}

/** Clears the counters for a successful sign-in, so one typo costs nothing later. */
export async function clearAttempts(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  for (const key of keys) localCounters.delete(key);

  try {
    await prisma.$executeRaw`DELETE FROM public.login_attempts WHERE key = ANY(${keys})`;
  } catch (error) {
    console.error(`${DEGRADED_MARKER} failed to clear attempt counters:`, error);
  }
}

/**
 * The caller's address, as far as it can be known behind a proxy.
 *
 * `x-forwarded-for` is a client-supplied header everywhere except behind a proxy
 * that overwrites it — which Vercel does. The leftmost entry is the origin
 * address there. It is not proof of anything, which is why the username is
 * counted separately: spreading an attack across addresses still runs into the
 * per-account limit.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return request.headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}
