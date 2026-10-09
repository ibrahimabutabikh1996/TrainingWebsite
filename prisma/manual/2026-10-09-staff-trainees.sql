-- Which trainees each staff member may see.
--
-- A staff member granted the subscribers section used to see every trainee.
-- Now they see only the ones the coach picked for them, and nobody else — not
-- in the list, not by opening a profile's address, not through a print page or
-- an attachment link. `sessionRefusal` in src/lib/authGuard.ts reads this table
-- on every request, on the query it already makes, so a change applies on the
-- staff member's next request.
--
-- One row per pairing. Deleting the staff member or the trainee deletes their
-- rows with them (ON DELETE CASCADE).
--
-- Additive only. It creates one table and touches nothing that exists, so it
-- cannot lose data. Re-running it is harmless.
--
-- Rollback:  DROP TABLE IF EXISTS public.staff_trainees;

CREATE TABLE IF NOT EXISTS public.staff_trainees (
  staff_account_id uuid        NOT NULL REFERENCES public.staff_accounts (account_id) ON DELETE CASCADE,
  profile_id       uuid        NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_account_id, profile_id)
);

-- Written only by the server through the service connection, like
-- staff_accounts. Row level security with no policies keeps the anon key out.
ALTER TABLE public.staff_trainees ENABLE ROW LEVEL SECURITY;
