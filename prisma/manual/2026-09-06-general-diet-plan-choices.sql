-- Two choices in one general plan.
--
-- 2026-09-06-general-diet-plans.sql made profile_id nullable so the coach could
-- write a diet before deciding who it is for. That gave general plans everything
-- a prescribed one has except the thing the screen is actually built around: a
-- trainee holds up to two alternatives — "الاختيار الأول" and "الاختيار الثاني" —
-- and picks between them. A general plan could hold only one, so a template
-- could never carry the pair it exists to hand over.
--
-- `position` already numbers the alternatives; what was missing was something to
-- say which rows are alternatives *of each other*. For a prescribed plan that is
-- profile_id — the two rows belong together because they belong to one person.
-- A general plan has no person, so it gets group_id: rows sharing one are one
-- template, and the library shows them as a single card.
--
-- group_id is NULL on every prescribed row and stays that way. The column is not
-- a second way to group a trainee's plans; profile_id is, and nothing here
-- changes that.
--
-- The partial unique index is the exact mirror of uq_diet_plans_profile_position:
-- one row per slot per template, so saving choice 2 twice updates it rather than
-- adding a third. Partial because the predicate keeps it off every prescribed
-- row, which has no group to be unique within — the same reason the older index
-- stops applying to rows with no owner.
--
-- Applied manually (this project has no Prisma migration history);
-- prisma/schema.prisma was edited to match. Re-running is safe.

BEGIN;

ALTER TABLE public.diet_plans
  ADD COLUMN IF NOT EXISTS group_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_diet_plans_group_position
  ON public.diet_plans (group_id, position)
  WHERE group_id IS NOT NULL;

COMMIT;
