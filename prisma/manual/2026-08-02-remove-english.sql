-- Arabic-only site: drop the English columns.
--
-- The app no longer reads or writes either column, so it keeps working whether
-- or not this file has been applied. Run it once you are satisfied that the
-- English copy is not needed — DROP COLUMN discards the stored data for good.

ALTER TABLE site_settings DROP COLUMN IF EXISTS content_en;

ALTER TABLE exercises DROP COLUMN IF EXISTS name_en;
