-- A name for the template itself.
--
-- 2026-09-06-general-diet-plan-choices.sql gave a general plan a group_id, so
-- its rows could say they are alternatives of each other. What it did not give
-- the template was a name: `name` is per row, and it is the name of one choice
-- — "الاختيار الأول". The library folded the rows into one card and then had
-- nothing to put on it but the first choice's name, so every template on that
-- screen was announced by its first alternative rather than by what it is.
--
-- group_name is that missing name. It is a property of the template, so every
-- row of one group carries the same value and the save writes it to all of
-- them; any row of the group answers "what is this template called".
--
-- Nullable, and NULL on every prescribed row: a trainee's plans are grouped by
-- profile_id and their card is named as it always was. NULL also on every
-- template written before this column existed — those keep falling back to the
-- first choice's name until the coach opens one and names it.
--
-- Applied manually (this project has no Prisma migration history);
-- prisma/schema.prisma was edited to match. Re-running is safe.

BEGIN;

ALTER TABLE public.diet_plans
  ADD COLUMN IF NOT EXISTS group_name text;

COMMIT;
