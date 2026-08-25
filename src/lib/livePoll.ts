/* How often an open page asks whether anything changed.
 *
 * Shared by the client hook and nothing else, but it lives here rather than in
 * the hook so the number is stated once and can be read from a test.
 *
 * Two values, because the machine this is developed on and the machine it is
 * served from are not the same machine. Development runs on two cores with the
 * project on a spinning disk, where every route is compiled on first request
 * and a poll landing mid-compile costs seconds — so the interval there is long
 * enough to stay out of the way. Production gets the fast one, which is the
 * point of the feature.
 *
 * `NEXT_PUBLIC_LIVE_POLL_MS` overrides both, for turning the dial without a
 * code change. `NODE_ENV` is inlined by the bundler, so this resolves at build
 * time and no branch of it reaches the browser twice.
 */

/** Production: fast enough that a coach watching a page sees a weight arrive. */
const PRODUCTION_MS = 5_000;

/** Development: present and working, but not a load generator. */
const DEVELOPMENT_MS = 60_000;

/** Never poll harder than this, whatever the environment says. */
const FLOOR_MS = 2_000;

function configured(): number | null {
  const raw = process.env.NEXT_PUBLIC_LIVE_POLL_MS;
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const LIVE_POLL_MS: number = Math.max(
  FLOOR_MS,
  configured() ?? (process.env.NODE_ENV === "production" ? PRODUCTION_MS : DEVELOPMENT_MS)
);

/* After a failed poll the interval doubles, up to this, and resets on the first
   success. A server that is down, restarting or recompiling should not be asked
   the same question every few seconds by every open tab. */
export const LIVE_BACKOFF_MAX_MS = 60_000;
