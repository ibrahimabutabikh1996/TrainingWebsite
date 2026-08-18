-- Makes a password change end the sessions that were opened with the old one.
--
-- The session token is signed rather than stored (see src/lib/session.ts), which
-- buys a stateless check on every request and costs the ability to revoke. The
-- comment there is honest about it: "a token cannot be revoked before it
-- expires". For an ordinary sign-out that is fine — the cookie is cleared. For a
-- password change it is not: the case people change their password *for* is that
-- someone else has it, and until now that someone kept their session for the
-- rest of its life. A week, or a month if "remember me" was ticked.
--
-- One column is enough to close it without giving up the stateless token. The
-- token carries when it was issued; this records when the password last changed;
-- a token issued before that timestamp is refused. No sessions table, no row per
-- sign-in, and the check folds into a lookup the guard already performs.
--
-- NULL means "never changed since this column existed", which is every row today
-- and refuses nothing. It is deliberately not defaulted to now(): a default would
-- stamp every existing account with the migration's own timestamp, and the
-- meaning of that value is "the password changed then", which would not be true.
--
-- Set by:  /api/auth/change-password, /api/admin/change-password,
--          scripts/reset-password.mjs
-- Not set by: the legacy-password upgrade in /api/auth/login — that rewrites how
--          the password is stored, not what it is, and stamping it there would
--          invalidate the session the sign-in is in the middle of creating.
--
-- Additive only. It adds one nullable column and touches no existing value, so
-- it cannot lose data. Re-running it is harmless.
--
-- Rollback:  ALTER TABLE public.accounts DROP COLUMN IF EXISTS password_changed_at;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

COMMENT ON COLUMN public.accounts.password_changed_at IS
  'When the password was last deliberately changed. Session tokens issued before this are refused. NULL = never changed.';

-- No index. It is only ever read by primary key, as part of the guard''s lookup
-- of the account the session names.
