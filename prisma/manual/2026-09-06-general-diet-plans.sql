-- A diet plan that belongs to nobody yet.
--
-- 2026-07-31-diet-plans.sql created this table as "the diet a given trainee was
-- actually prescribed", and made profile_id NOT NULL to say so. That was right
-- for what the table then held, and it is what stopped the coach from writing a
-- diet before deciding who it is for — the training side has always allowed it
-- (courses carries no profile_id at all; a course reaches a trainee through
-- client_courses and profiles.current_course_id), and the two screens should
-- not disagree about whether that is possible.
--
-- So: profile_id becomes nullable, and a NULL owner means a general plan. The
-- coach writes one, it sits in the diet library, and assigning it to a trainee
-- takes a COPY — copyDietPlanToTraineeAction — never a shared row. That rule is
-- the whole reason the library is safe to reuse: two people pointed at one
-- meals_data blob means editing it for one silently rewrites the other's, and
-- what a trainee may eat is decided by their own allergies and injuries.
--
-- What this does NOT weaken, which is worth stating because it looks as though
-- it might: uq_diet_plans_profile_position still enforces one plan per slot per
-- trainee exactly as before. Postgres treats NULLs in a unique index as
-- distinct from each other, so the constraint simply stops applying to rows
-- that have no owner — and general plans have no slot to collide over. Every
-- row with a real profile_id is constrained precisely as it was.
--
-- Nor does it change any existing read. All seven places that read diet_plans
-- filter on `profile_id = <a real uuid>`: /api/profile, /export-diet,
-- /export-profile, AdminSubscriptionTimeline, the plan builder's page, the
-- builder's own upsert/delete, and the per-profile fingerprint in /api/live.
-- None of them can match NULL, so none of them can see a general plan.
--
-- The FK keeps ON DELETE CASCADE: a trainee's own plans still go with them, and
-- general plans are not theirs to take.
--
-- Applied manually (this project has no Prisma migration history);
-- prisma/schema.prisma was edited to match. Re-running is safe.

BEGIN;

ALTER TABLE public.diet_plans
  ALTER COLUMN profile_id DROP NOT NULL;

COMMIT;
