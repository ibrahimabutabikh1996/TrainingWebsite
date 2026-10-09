-- Staff: accounts the coach creates for helpers, each with the panel sections
-- and actions the coach chose for them.
--
-- Until now the panel had one kind of user, the coach, recognised by username in
-- src/lib/adminUsernames.ts. A row here makes an account a staff member; what it
-- may do is `permissions`, read on every request by `sessionRefusal` in
-- src/lib/authGuard.ts, so a change the coach makes applies on the next request
-- rather than when the staff member's cookie expires.
--
-- permissions  e.g. {'subscribers.view','courses.edit','subscribers.renew'}.
--              The vocabulary lives in src/lib/staffPermissions.ts; anything
--              not listed there is ignored.
-- is_suspended The coach's off switch. A suspended staff member is refused on
--              every guarded request, signed in or not.
--
-- Deleting the account deletes this row with it (ON DELETE CASCADE).
--
-- Additive only. It creates one table and touches nothing that exists, so it
-- cannot lose data. Re-running it is harmless.
--
-- Rollback:  DROP TABLE IF EXISTS public.staff_accounts;

CREATE TABLE IF NOT EXISTS public.staff_accounts (
  account_id   uuid        PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  permissions  text[]      NOT NULL DEFAULT '{}',
  is_suspended boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Written only by the server through the service connection, like the tables
-- locked down in 2026-08-21-pot03-lock-down-storage-and-rls.sql. Row level
-- security with no policies keeps the anon key out of it entirely.
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
