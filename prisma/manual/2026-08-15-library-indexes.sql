-- Indexes for the two library tables, which had none at all.
--
-- `exercises` and `nutrition_sources` are the only tables in the public schema
-- with no index but their primary key. Both are read on every load of the pages
-- that use them, and both are read the same way: the whole table, newest first.
-- With no index on created_at that is a sequential scan and a sort on every
-- request. Neither table is large today, which is exactly why this is cheap to
-- add now and awkward to notice later — the query does not fail as it grows, it
-- just takes longer.
--
--   exercises           /admin/exercises, /admin/builder, /export-workout
--   nutrition_sources   /admin/diet, /admin/diet/plan
--
-- The second index on each is for the filter the pages apply after loading:
-- exercises are grouped by target muscle in the builder's picker, and nutrition
-- sources by category in the plan builder. Those are done in the client today,
-- so the index buys nothing yet — it is what makes moving the filter into the
-- query a one-line change rather than a schema change under load.
--
-- Additive only. It creates four indexes and touches no data, so it cannot lose
-- anything. Re-running it is harmless.
--
-- CONCURRENTLY is deliberately not used: these tables are small enough that the
-- brief lock is imperceptible, and CONCURRENTLY cannot run inside a transaction
-- block, which is how a SQL file pasted into the Supabase editor is executed.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_exercises_created;
--   DROP INDEX IF EXISTS public.idx_exercises_target_muscle;
--   DROP INDEX IF EXISTS public.idx_nutrition_sources_created;
--   DROP INDEX IF EXISTS public.idx_nutrition_sources_category;

CREATE INDEX IF NOT EXISTS idx_exercises_created
  ON public.exercises (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercises_target_muscle
  ON public.exercises (target_muscle);

CREATE INDEX IF NOT EXISTS idx_nutrition_sources_created
  ON public.nutrition_sources (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nutrition_sources_category
  ON public.nutrition_sources (category);

-- prisma/schema.prisma carries the matching @@index entries. Keeping the two in
-- step is what stops the next `prisma db pull` or migration diff from offering
-- to drop these as indexes the schema does not know about.
