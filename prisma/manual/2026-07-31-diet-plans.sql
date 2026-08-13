-- The diet a given trainee was actually prescribed.
--
-- public.nutrition_sources is a library: it says what the coach *may* prescribe.
-- It had no link to any trainee, so a plan could be designed on screen and then
-- had nowhere to be saved. This table is that link.
--
-- The five meal slots — breakfast, snack, lunch, snack, dinner — are fixed by
-- the plan's definition, so they live inside meals_data as jsonb rather than as
-- five columns: the slots never change, only their contents, and a column per
-- slot would cost a migration every time a slot gained a field. This mirrors
-- courses.days_data.
--
-- Items inside meals_data COPY the name, serving size and macros from the
-- library at the moment the coach adds them, and keep refId only to trace the
-- origin. A plan is a point-in-time document: editing a source's macros — or
-- deleting the source — must not silently rewrite a plan already handed to a
-- trainee. That is deliberate, and it is why no foreign key reaches from the
-- jsonb into nutrition_sources. It is the same rule courses already follow for
-- exercise names.
--
-- One trainee may hold more than one plan (a training-day diet and a rest-day
-- one, say). `position` orders them and makes each slot addressable; how many
-- slots exist is an application rule, not a constraint here, so raising the cap
-- later needs no migration.
--
-- Applied manually (this project has no Prisma migration history);
-- prisma/schema.prisma was edited to match. Re-running is safe.

BEGIN;

CREATE TABLE IF NOT EXISTS public.diet_plans (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  position   smallint    NOT NULL DEFAULT 1,
  meals_data jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One plan per slot per trainee: saving slot 2 twice must update, never
-- duplicate. The application upserts on this pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_diet_plans_profile_position
  ON public.diet_plans (profile_id, position);

CREATE INDEX IF NOT EXISTS idx_diet_plans_profile
  ON public.diet_plans (profile_id, position);

-- Matches the other trainee tables: row level security on, no policies, since
-- every read and write goes through the server's own connection.
ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;

COMMIT;
