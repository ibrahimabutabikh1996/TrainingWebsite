-- A cycle carries the plan it was performed against.
--
-- The trainee's screen used to read the exercises straight off the course
-- currently assigned to them. Assign a different course — or edit the assigned
-- one — and every cycle, finished ones included, silently re-labelled itself:
-- weights recorded against "ضغط بنش" would appear under whatever exercise now
-- sat in that day's slot. The numbers were right and the names were wrong, which
-- is worse than either.
--
-- So the plan is copied onto the cycle when the cycle opens, and the cycle reads
-- from its own copy from then on. This is the same rule the course builder
-- already follows for exercise names inside a programme: a programme is a
-- point-in-time document, not a live join. A new or edited course therefore
-- takes effect from the trainee's next cycle, and the one they are inside
-- finishes on the plan they started it with.
--
-- Nullable: a cycle that predates this column falls back to the assigned course.
--
-- Applied manually (this project has no Prisma migration history);
-- prisma/schema.prisma was edited to match. Re-running is safe.

BEGIN;

ALTER TABLE public.training_cycles
  ADD COLUMN IF NOT EXISTS plan_data jsonb;

COMMIT;
