-- POT-03 phase 2 — the `uploads` bucket becomes private.
--
-- Phase 1 (2026-08-21-pot03-lock-down-storage-and-rls.sql) closed the table
-- enumeration and the anonymous write and delete. What it deliberately left
-- open was anonymous READ and LIST, because the same bucket also held the page
-- imagery, and taking reads away would have blanked the landing page for every
-- visitor.
--
-- That is no longer true. The CMS media now lives in its own public bucket,
-- `public-media`, and the eight stored addresses that pointed into `uploads`
-- were repointed at it and each verified to serve before the row was written.
-- `uploads` is left holding only `usersData/` — payment receipts, body
-- photographs, medical analyses — none of which should ever be readable without
-- authorisation.
--
-- Reads of those files continue to work through `/api/attachments`, which was
-- already built for exactly this and is exercised by tests: it checks the
-- session and the ownership of the profile the file is filed under, then
-- redirects to a short-lived signed URL. A signed URL is issued by the service
-- role and is not subject to the policy dropped below, so removing public reads
-- does not affect it.
--
-- Uploads are unaffected: `createSignedUploadUrl` issues a token bound to one
-- object, and the trainee files never moved, so no path, no `upload_items` row
-- and no value in `profiles.data` changes.
--
-- Rollback
-- --------
--   UPDATE storage.buckets SET public = true WHERE name = 'uploads';
--   CREATE POLICY "Allow public read" ON storage.objects FOR SELECT TO public
--     USING (bucket_id = 'uploads'::text);
-- The migration manifest (tests/http/pot03-migration-manifest.json) records the
-- copied objects and the before/after of every rewritten address.

UPDATE storage.buckets SET public = false WHERE name = 'uploads';

DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
