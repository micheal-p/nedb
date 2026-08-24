-- ── 042: Public API exposure control ───────────────────────────────────────
-- Until now every series in the registry was served publicly, and the JSON
-- data route returned SELECT * — so internal columns (notes, review state,
-- upload session ids) reached anonymous callers, and a series auto-ingested
-- and marked "pending review" was public the moment it landed.
--
-- Publication is now an explicit administrative act:
--   is_public      — nothing is served publicly until an admin publishes it
--   public_fields  — the exact columns exposed for that series
--   public_note    — optional caveat shown in the API docs and payload
--
-- Existing series are published in this migration so the live public site
-- keeps working; anything NEW defaults to unpublished, which is the correct
-- posture for a statistics office.

ALTER TABLE series_types
  ADD COLUMN IF NOT EXISTS is_public     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_fields TEXT[]  NOT NULL DEFAULT ARRAY['period','period_date','value','unit','region','source'],
  ADD COLUMN IF NOT EXISTS public_note   TEXT;

-- Publish what was already being served, so nothing regresses on deploy.
UPDATE series_types SET is_public = true;

-- Newly registered fiscal series stay unpublished until an admin reviews the
-- figures — tax receipts are the most sensitive data on the platform.
UPDATE series_types SET is_public = false
 WHERE id IN ('hydrocarbon_tax', 'cit_energy', 'gas_flare_penalties');

-- ── API keys become real ───────────────────────────────────────────────────
-- Keys existed but no route ever validated one, so issuing and revoking were
-- both no-ops. Add the columns needed to enforce and meter them.
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS scopes      TEXT[] NOT NULL DEFAULT ARRAY['read'],
  ADD COLUMN IF NOT EXISTS rate_limit  INT    NOT NULL DEFAULT 600,
  ADD COLUMN IF NOT EXISTS call_count  BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key) WHERE is_active;
