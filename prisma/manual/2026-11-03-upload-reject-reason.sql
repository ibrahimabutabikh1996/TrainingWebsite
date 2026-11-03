-- Keeps the reason an uploaded file was refused.
--
-- `rejectItem` in src/lib/uploadSessions.ts deletes the object and marks the row
-- 'rejected', and until now the reason went to `console.warn` and nowhere else —
-- a Vercel log line, kept for hours. Late October had a run of refused payment
-- receipts and body photos from people who then never finished registering, and
-- by the time anyone looked there was no way left to say why.
--
-- Written by:  rejectItem (src/lib/uploadSessions.ts), the same moment the
--              status becomes 'rejected'. Free text, the same string the log
--              line carries — e.g. "oversized (12000000 bytes)".
--
-- NULL on every row rejected before this column existed, and on every row that
-- was never rejected. Nothing reads it to decide anything.
--
-- Must run BEFORE the code that writes it is deployed: until the column exists,
-- that update fails and the visitor sees a server error instead of "الملف غير
-- صالح".
--
-- Additive only. It adds one nullable column and touches no existing value, so
-- it cannot lose data. Re-running it is harmless.
--
-- Rollback:  ALTER TABLE public.upload_items DROP COLUMN IF EXISTS reject_reason;

ALTER TABLE public.upload_items
  ADD COLUMN IF NOT EXISTS reject_reason text;

COMMENT ON COLUMN public.upload_items.reject_reason IS
  'Why the file was refused at confirmation, when status = ''rejected''. NULL otherwise, and on rows rejected before 2026-11-03.';
