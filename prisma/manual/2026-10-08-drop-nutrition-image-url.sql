-- Drop the per-food picture.
--
-- The diet screens no longer show a picture beside a food — neither the
-- category PNG nor a food's own `image_url` — so the column has no reader and
-- no writer left. The form stopped offering an upload long before this, and on
-- 2026-10-08 the column was NULL on all 110 rows, so nothing is lost.
--
-- Run this only AFTER the code that no longer selects the column is deployed:
-- Prisma names every column in its SELECT, so the old code against a table
-- without `image_url` fails on /admin/diet and /admin/diet/plan.
--
-- To undo: ALTER TABLE public.nutrition_sources ADD COLUMN image_url text;
--
-- Applied manually (this project has no Prisma migration history);
-- prisma/schema.prisma was edited to match. Re-running is safe.

BEGIN;

ALTER TABLE public.nutrition_sources
  DROP COLUMN IF EXISTS image_url;

COMMIT;
