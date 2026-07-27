-- Training weeks counted by workouts completed, not by the calendar.
--
-- Before: a week was a calendar week (Saturday–Friday) and `week_start` keyed it,
-- so a postponed workout was lost when the calendar rolled over.
-- After: a week is a cycle of `days_count` workouts. It closes the moment the
-- trainee has recorded that many sessions, whatever dates they fell on, and the
-- next cycle opens. `week_number` orders the cycles; `completed_at` closes them.
--
-- Applied manually (this project has no Prisma migration history); prisma/schema.prisma
-- was edited to match. Re-running is safe.

BEGIN;

ALTER TABLE public.training_weeks
  ADD COLUMN IF NOT EXISTS week_number  integer,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Number any pre-existing cycles in the order they were lived through, and close
-- all but the newest of each trainee — a calendar week that already rolled over
-- is finished by definition.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'training_weeks' AND column_name = 'week_start'
  ) THEN
    UPDATE public.training_weeks w
    SET week_number = o.n
    FROM (
      SELECT id,
             row_number() OVER (PARTITION BY profile_id ORDER BY week_start, created_at) AS n
      FROM public.training_weeks
    ) o
    WHERE w.id = o.id AND w.week_number IS NULL;

    UPDATE public.training_weeks w
    SET completed_at = now()
    WHERE w.completed_at IS NULL
      AND w.week_number < (
        SELECT max(m.week_number) FROM public.training_weeks m WHERE m.profile_id = w.profile_id
      );

    DROP INDEX IF EXISTS public.uq_training_weeks_profile_week;
    DROP INDEX IF EXISTS public.idx_training_weeks_profile;
    ALTER TABLE public.training_weeks DROP COLUMN week_start;
  END IF;
END $$;

ALTER TABLE public.training_weeks ALTER COLUMN week_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_training_weeks_profile_number
  ON public.training_weeks (profile_id, week_number);

-- A trainee is inside exactly one cycle at a time; the open one is the current one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_training_weeks_open
  ON public.training_weeks (profile_id) WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_training_weeks_profile
  ON public.training_weeks (profile_id, week_number DESC);

COMMIT;
