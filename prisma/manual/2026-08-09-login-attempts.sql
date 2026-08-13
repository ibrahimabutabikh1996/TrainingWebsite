-- Rate limiting for the sign-in endpoint (audit item H6).
--
-- Why a table and not a variable: the site is deployed to Vercel, where each
-- request may be served by a different instance with its own memory. A counter
-- held in the process counts only the attempts that happened to reach that
-- instance, so the limit it enforces is a fraction of the one it claims. The
-- count has to live somewhere all instances share, and Postgres is already
-- there.
--
-- Additive only. It creates one table and touches nothing that exists, so it
-- cannot lose data. Re-running it is harmless.
--
-- Until this is applied, `consumeAttempt` logs an error and lets every request
-- through — sign-in keeps working, unprotected. See src/lib/rateLimit.ts.
--
-- Rollback:  DROP TABLE IF EXISTS public.login_attempts;

CREATE TABLE IF NOT EXISTS public.login_attempts (
  -- "ip:<address>" or "user:<username>" — both are counted, separately.
  key          text        PRIMARY KEY,
  attempts     integer     NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Rows outlive their window and nothing reads them again. This index makes the
-- occasional sweep below cheap.
CREATE INDEX IF NOT EXISTS idx_login_attempts_window
  ON public.login_attempts (window_start);

-- Housekeeping, to be run whenever convenient (a cron job, or by hand):
--   DELETE FROM public.login_attempts WHERE window_start < now() - INTERVAL '1 day';

-- The table holds no personal data beyond an address and a submitted username,
-- and it is written only by the server through the service connection. Row level
-- security is therefore not enabled here, matching the other application tables
-- in this schema.
