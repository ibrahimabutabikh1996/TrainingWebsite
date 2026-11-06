-- Challenges: the coach sets one ("30 push-ups", "2-minute plank"), a trainee
-- films themselves doing it and sends the video to the coach on WhatsApp, and
-- the coach approves it from the panel — which is what awards the points.
--
-- The video never touches this database. The trainee's "done" button opens
-- WhatsApp with a prefilled message carrying a reference (CH-XXXXXX) and records
-- a pending row here; the coach watches the video in WhatsApp and presses "تم"
-- in /admin/challenges, which stamps the row approved and its points.
--
-- A trainee's points are the sum of `points_awarded` over their approved rows.
-- There is no separate balance to drift out of step with the record.
--
-- Until this file is run, the challenges screen in the panel says so, the
-- trainee's challenges tab shows nothing, and nothing else is affected.
--
-- Additive only: two new tables, nothing existing is touched. Re-running it is
-- harmless.
--
-- Rollback:  DROP TABLE IF EXISTS public.challenge_submissions;
--            DROP TABLE IF EXISTS public.challenges;

CREATE TABLE IF NOT EXISTS public.challenges (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  description     text        NOT NULL DEFAULT '',
  -- What counts as done, as the trainee reads it: "30 تكرار", "دقيقتين".
  target          text        NOT NULL DEFAULT '',
  points          integer     NOT NULL DEFAULT 10 CHECK (points >= 0 AND points <= 10000),
  -- An optional demonstration link (YouTube, Instagram…).
  video_url       text,
  starts_at       timestamptz,
  ends_at         timestamptz,
  is_active       boolean     NOT NULL DEFAULT true,
  -- The staff member who made it; NULL for the coach's own. Same convention as
  -- courses.created_by — see prisma/manual/2026-10-09-created-by.sql.
  created_by      uuid        REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_active ON public.challenges (is_active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.challenge_submissions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id     uuid        NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  profile_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The code in the trainee's WhatsApp message, so the coach can tell which
  -- video belongs to which request.
  reference        text        NOT NULL UNIQUE,
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Copied from the challenge when approved, so editing the challenge later
  -- does not rewrite points already earned.
  points_awarded   integer     NOT NULL DEFAULT 0,
  reject_reason    text,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_at      timestamptz,
  reviewed_by_name text,
  -- One row per trainee per challenge. A rejected one is reset to pending when
  -- the trainee tries again, rather than a second row being added.
  CONSTRAINT uq_challenge_submissions_entry UNIQUE (challenge_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_submissions_status
  ON public.challenge_submissions (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_profile
  ON public.challenge_submissions (profile_id);

-- Written only by the server through the service connection, like every other
-- table here. Row level security with no policies keeps the anon key out.
ALTER TABLE public.challenges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_submissions ENABLE ROW LEVEL SECURITY;
