-- Rest days the trainee marks for themselves.
--
-- Training days are not fixed, so neither are the days off between them. The
-- trainee names their own rest days out of the days their subscription covers;
-- a rest day is a record, never a workout, so it counts towards no cycle.
--
-- One row per (trainee, day): a given day is either a rest day or it is not.
--
-- Applied manually (this project has no Prisma migration history);
-- prisma/schema.prisma was edited to match. Re-running is safe.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rest_days (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rest_on    date        NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rest_days_profile_date
  ON public.rest_days (profile_id, rest_on);

CREATE INDEX IF NOT EXISTS idx_rest_days_profile
  ON public.rest_days (profile_id, rest_on DESC);

-- Matches the other training tables: row level security on, no policies, since
-- every read and write goes through the server's own connection.
ALTER TABLE public.rest_days ENABLE ROW LEVEL SECURITY;

COMMIT;
