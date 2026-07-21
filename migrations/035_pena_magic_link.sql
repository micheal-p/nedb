-- ── 035: PENA magic-link email verification ──────────────────────────────────
-- Run in the Supabase SQL editor after 034.
--
-- Per-form toggle: when require_verification is on, a submitted response is
-- stored as 'pending' and the respondent gets a one-tap confirmation link by
-- email (/v/<verify_token>). Clicking proves inbox ownership → 'verified'.
-- Insights and public aggregates count ONLY verified rows; pending rows stay
-- visible to staff, flagged, and are treated as expired after 48 hours
-- (computed at read time — no cron needed). Google-signed submissions skip
-- the link entirely: Google already verified the email.

ALTER TABLE pena_forms ADD COLUMN IF NOT EXISTS require_verification BOOLEAN NOT NULL DEFAULT false;

-- Existing rows (and rows on toggle-off forms) default to 'verified'.
ALTER TABLE pena_responses ADD COLUMN IF NOT EXISTS verify_status TEXT NOT NULL DEFAULT 'verified'
  CHECK (verify_status IN ('verified','pending'));
ALTER TABLE pena_responses ADD COLUMN IF NOT EXISTS verify_token TEXT UNIQUE;
ALTER TABLE pena_responses ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pena_responses_vtoken
  ON pena_responses(verify_token) WHERE verify_token IS NOT NULL;
