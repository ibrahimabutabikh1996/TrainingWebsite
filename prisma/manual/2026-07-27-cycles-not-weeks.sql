-- There is no such thing as a week here.
--
-- A trainee's unit of progress is a *cycle*: the number of workouts they said
-- they could commit to, in whatever order and on whatever dates they record
-- them. Nothing about it is seven days long, and nothing starts or ends it but
-- the count. The schema said "week" only because the first implementation was
-- calendar-driven, and leaving the word in place is what keeps inviting
-- calendar assumptions back in.
--
--   training_weeks              → training_cycles
--   training_weeks.week_number  → training_cycles.cycle_number
--   training_sessions.week_id   → training_sessions.cycle_id
--
-- The day-count guard is widened at the same time. 1–7 was the week showing
-- through; the guard is only there so a nonsense answer cannot create session
-- rows without end, so a plain sanity bound does the job.
--
-- Applied manually (this project has no Prisma migration history);
-- prisma/schema.prisma was edited to match. Re-running is safe.

BEGIN;

ALTER TABLE IF EXISTS public.training_weeks RENAME TO training_cycles;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'training_cycles' AND column_name = 'week_number'
  ) THEN
    ALTER TABLE public.training_cycles RENAME COLUMN week_number TO cycle_number;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'training_sessions' AND column_name = 'week_id'
  ) THEN
    ALTER TABLE public.training_sessions RENAME COLUMN week_id TO cycle_id;
  END IF;
END $$;

ALTER INDEX IF EXISTS public.uq_training_weeks_profile_number RENAME TO uq_training_cycles_profile_number;
ALTER INDEX IF EXISTS public.uq_training_weeks_open          RENAME TO uq_training_cycles_open;
ALTER INDEX IF EXISTS public.idx_training_weeks_profile      RENAME TO idx_training_cycles_profile;
ALTER INDEX IF EXISTS public.uq_training_sessions_week_day   RENAME TO uq_training_sessions_cycle_day;
ALTER INDEX IF EXISTS public.idx_training_sessions_week      RENAME TO idx_training_sessions_cycle;

/* RENAME CONSTRAINT has no IF EXISTS, so each is guarded by hand. */
DO $$
DECLARE
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ['training_cycles',   'training_weeks_pkey',             'training_cycles_pkey'],
    ['training_cycles',   'training_weeks_course_id_fkey',   'training_cycles_course_id_fkey'],
    ['training_cycles',   'training_weeks_profile_id_fkey',  'training_cycles_profile_id_fkey'],
    ['training_cycles',   'training_weeks_days_ck',          'training_cycles_days_ck'],
    ['training_sessions', 'training_sessions_week_id_fkey',  'training_sessions_cycle_id_fkey']
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = pair[2] AND conrelid = ('public.' || pair[1])::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', pair[1], pair[2], pair[3]);
    END IF;
  END LOOP;
END $$;

/* A guard against absurd values, not a statement about weeks. */
ALTER TABLE public.training_cycles DROP CONSTRAINT IF EXISTS training_cycles_days_ck;
ALTER TABLE public.training_cycles
  ADD CONSTRAINT training_cycles_days_ck CHECK (days_count >= 1 AND days_count <= 14);

COMMIT;
