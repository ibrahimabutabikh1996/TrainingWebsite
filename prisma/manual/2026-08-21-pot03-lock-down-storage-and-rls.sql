-- POT-03 — close the Supabase exposure found by the security audit.
--
-- What was wrong
-- --------------
-- Four tables in `public` had row level security switched off, and the anon key
-- — which is shipped to every browser by design — could therefore read them
-- straight through PostgREST, with no application code involved:
--
--     upload_items       26/26 rows, including every object's storage_path
--     upload_sessions    10/10 rows, including account_id, profile_id, client_ip
--     login_attempts     75/75 rows, i.e. which usernames are being attacked
--     nutrition_sources  109/109 rows, the coach's own nutrition library
--
-- And the `uploads` bucket was public with four `{public}` policies on
-- storage.objects granting SELECT, INSERT, UPDATE and DELETE to anyone. Read
-- together with the paths listed above, that was not a theoretical exposure: a
-- test proved an anonymous caller could read, enumerate and DELETE a real
-- trainee's file. The uploads are payment receipts, body photographs and
-- medical analyses.
--
-- Why enabling RLS here is safe
-- -----------------------------
-- Nothing client-side reads these tables. The only anon Supabase client in the
-- project is `src/lib/signedUpload.ts`, and it calls
-- `storage.from("uploads").uploadToSignedUrl(...)` and nothing else — it never
-- queries a table. Every table read goes through Prisma, which connects as
-- `postgres`: owner of these tables and `rolbypassrls = true`, so RLS does not
-- apply to it. `accounts` and `profiles` have run with RLS on and no policies
-- for some time already, and the application reads them without trouble — that
-- is the same configuration this applies to the remaining four.
--
-- No policies are added on purpose. RLS with no policy denies everyone the
-- policies do not name, which is exactly the intent: these tables have no
-- browser-side reader to accommodate.
--
-- Storage: the three write policies go, the read policy stays for now
-- ------------------------------------------------------------------
-- INSERT/UPDATE/DELETE for `public` are removed here. Signed uploads do not
-- need them — `createSignedUploadUrl` issues a token that authorises one exact
-- object, and that path is what the browser uses — and every server-side write
-- and delete goes through the service role, which is not subject to these
-- policies either.
--
-- The public SELECT policy and `buckets.public = true` are deliberately NOT
-- touched by this file. Turning off public reads breaks image rendering until
-- the display sites are pointed at the authorising reader, so that belongs in
-- its own change, applied together with the code that depends on it.
--
-- Rollback
-- --------
-- Each statement below has its inverse in a comment beside it. The baseline
-- this was taken against is recorded in tests/http/pot03-baseline.json.

-- ---------------------------------------------------------------- tables --
-- Rollback: ALTER TABLE ... DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_sources ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------- storage --
-- Rollback, verbatim from the baseline snapshot:
--   CREATE POLICY "Allow public uploads" ON storage.objects FOR INSERT TO public
--     WITH CHECK (bucket_id = 'uploads'::text);
--   CREATE POLICY "Allow public updates" ON storage.objects FOR UPDATE TO public
--     USING (bucket_id = 'uploads'::text);
--   CREATE POLICY "Allow public deletes" ON storage.objects FOR DELETE TO public
--     USING (bucket_id = 'uploads'::text);
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;
