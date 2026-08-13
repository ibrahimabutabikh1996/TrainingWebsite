-- Server-side lifecycle for uploads (Phase 2.5).
--
-- Why this exists: the browser is about to upload straight to Supabase, because
-- Vercel refuses a request body over about 4.5 MB and a phone photo alone can
-- exceed it. Once the bytes no longer pass through the app, the app has to hold
-- the authorisation somewhere else — otherwise "which file, for whom, in which
-- field" is decided by whatever the client says it is.
--
-- These two tables are that somewhere. The server issues a session, names every
-- storage path itself, and records what state each object is in:
--
--     created -> uploaded -> confirmed -> attached
--
-- The client never picks a path, a bucket, a profile or a field it was not
-- granted. It only ever hands back an id the server issued, and the server looks
-- everything else up here.
--
-- Additive only: two new tables, nothing existing is touched. Re-running is
-- harmless.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.upload_items;
--   DROP TABLE IF EXISTS public.upload_sessions;

CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 'registration' (nobody is signed in yet), 'renewal', or 'cms'.
  scope        text        NOT NULL,

  -- Who the session belongs to, when that is knowable. Registration has neither
  -- until the form is submitted, which is exactly why the session needs an
  -- expiry and a rate limit of its own rather than relying on a signed-in user.
  account_id   uuid        REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id   uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- open -> consumed. A consumed session can never issue or confirm again.
  status       text        NOT NULL DEFAULT 'open',

  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,

  -- For rate limiting and for tracing abuse back. Not an identity.
  client_ip    text,

  CONSTRAINT upload_sessions_scope_check
    CHECK (scope IN ('registration', 'renewal', 'cms')),
  CONSTRAINT upload_sessions_status_check
    CHECK (status IN ('open', 'consumed'))
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_expiry
  ON public.upload_sessions (expires_at) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_upload_sessions_profile
  ON public.upload_sessions (profile_id);

CREATE TABLE IF NOT EXISTS public.upload_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES public.upload_sessions(id) ON DELETE CASCADE,

  -- Which form field the session was granted this slot for. Checked on confirm,
  -- so a slot issued for a lab report cannot be attached as a body photo.
  field         text        NOT NULL,

  -- Built entirely by the server. Unique, so one path can never be claimed twice.
  storage_path  text        NOT NULL UNIQUE,

  -- created   : a signed upload URL was issued, nothing verified yet
  -- confirmed : the object exists, its bytes were read and accepted
  -- rejected  : the object failed verification and was deleted from storage
  -- attached  : the confirmed object is referenced by a profile — never swept
  status        text        NOT NULL DEFAULT 'created',

  -- Filled in at confirmation, from the object itself rather than from the client.
  detected_type text,
  mime          text,
  size_bytes    bigint,

  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz,
  attached_at   timestamptz,

  CONSTRAINT upload_items_status_check
    CHECK (status IN ('created', 'confirmed', 'rejected', 'attached'))
);

CREATE INDEX IF NOT EXISTS idx_upload_items_session ON public.upload_items (session_id);

-- Drives the sweep: everything not yet attached, oldest first.
CREATE INDEX IF NOT EXISTS idx_upload_items_sweep
  ON public.upload_items (status, created_at) WHERE status <> 'attached';
