-- Who made each course and each diet plan, when it was a staff member.
--
-- A staff member sees only the courses and diets they made themselves, and the
-- coach sees a "من عمل" badge on those. Both read these two columns:
--
--   created_by       the staff account that made the row. NULL for the coach's
--                    own work — every row that exists today — and set back to
--                    NULL if that staff account is deleted (ON DELETE SET NULL).
--   created_by_name  the staff member's username, copied when the row is made.
--                    It outlives the account, so a deleted staff member's work
--                    still reads "من عمل: … (مشرف سابق)" rather than passing
--                    silently as the coach's.
--
-- So: both NULL is the coach's; created_by set is a current staff member's; a
-- name with no created_by is a former staff member's.
--
-- `courses.coach_id` is unchanged. It still names the account that owns the
-- course and is still handed to the coach when a staff member is deleted.
--
-- Additive only. It adds four nullable columns and touches no existing value,
-- so it cannot lose data. Re-running it is harmless.
--
-- Rollback:
--   ALTER TABLE public.courses    DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS created_by_name;
--   ALTER TABLE public.diet_plans DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS created_by_name;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS created_by      uuid REFERENCES public.accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name text;

ALTER TABLE public.diet_plans
  ADD COLUMN IF NOT EXISTS created_by      uuid REFERENCES public.accounts (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- A staff member's library is filtered on these on every load.
CREATE INDEX IF NOT EXISTS idx_courses_created_by    ON public.courses (created_by);
CREATE INDEX IF NOT EXISTS idx_diet_plans_created_by ON public.diet_plans (created_by);
