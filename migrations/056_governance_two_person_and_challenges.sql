-- ── 056: two-person unfreeze, and a public route to challenge a figure ──────
-- Run after 055.
--
-- Two gaps the Code of Practice already names.
--
-- 1. UNFREEZING IS STILL ONE PERSON
--
-- Freezing a period locks a published figure. Unfreezing reopens it to change,
-- which is the more consequential half: it is the only way a published national
-- statistic can be altered. It is superadmin-only, but a single superadmin can
-- still do it alone, and the whole maker-checker argument the platform rests on
-- says that is not enough for the most consequential act in the system.
--
-- An unfreeze now needs two different people: one to request it with a stated
-- reason, another to approve. The database enforces that they are different,
-- because a rule that lives only in application code is a convention.
--
-- 2. A DISPUTED FIGURE HAS NOWHERE TO GO
--
-- Anyone can read these statistics; nobody outside NEDB has a way to say "that
-- number is wrong" and get an answer. A correction procedure is not a courtesy,
-- it is part of what makes a figure trustworthy: it is the mechanism by which
-- being wrong gets discovered by someone other than the producer.
--
-- The outcome is published whether or not the challenge succeeds. A complaints
-- process whose results are private is a suggestion box.

-- ── Two-person unfreeze ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unfreeze_requests (
  id              BIGSERIAL PRIMARY KEY,
  series_type_id  TEXT NOT NULL,
  period          TEXT NOT NULL,
  -- Why the published figure needs to be reopened. Required: an unfreeze with
  -- no stated reason is exactly what this table exists to prevent.
  reason          TEXT NOT NULL,
  requested_by    TEXT NOT NULL,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | withdrawn | used
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  decision_note   TEXT,
  -- Set when the approval is actually spent on an unfreeze, so one approval
  -- cannot be reused to reopen the same period again later.
  used_at         TIMESTAMPTZ,

  CONSTRAINT unfreeze_status_check
    CHECK (status IN ('pending','approved','rejected','withdrawn','used')),

  -- The rule, in the database rather than in a code path someone can forget.
  CONSTRAINT unfreeze_two_person
    CHECK (approved_by IS NULL OR approved_by <> requested_by)
);

CREATE INDEX IF NOT EXISTS idx_unfreeze_open
  ON unfreeze_requests(series_type_id, period, status);

ALTER TABLE unfreeze_requests ENABLE ROW LEVEL SECURITY;
-- No policy: the service role bypasses RLS and nothing else may touch this.

COMMENT ON TABLE unfreeze_requests IS
  'Two-person rule for reopening a frozen period. One superadmin requests with a reason, a different one approves, and the approval is spent when used.';

-- ── Public challenge to a published figure ──────────────────────────────────

CREATE TABLE IF NOT EXISTS figure_challenges (
  id               BIGSERIAL PRIMARY KEY,
  -- Quoted back to the submitter so they can follow it up without an account.
  reference        TEXT UNIQUE NOT NULL,

  -- What is being disputed. series and period are required; region optional
  -- because a national figure has none.
  series_type_id   TEXT NOT NULL,
  period           TEXT NOT NULL,
  region           TEXT,
  -- The value as published at the moment of the challenge, captured so the
  -- record still makes sense after a revision.
  published_value  NUMERIC,
  published_unit   TEXT,

  grounds          TEXT NOT NULL,     -- why they believe it is wrong
  evidence         TEXT,              -- a citation, a link, a source

  submitter_name   TEXT NOT NULL,
  submitter_email  TEXT NOT NULL,
  submitter_org    TEXT,

  status           TEXT NOT NULL DEFAULT 'received',
  -- received        logged, not yet looked at
  -- reviewing       being assessed
  -- upheld          the figure was wrong and has been corrected
  -- partially_upheld something was wrong, but not as claimed
  -- not_upheld      the figure stands
  -- withdrawn       the submitter withdrew it

  outcome          TEXT,              -- the reasoning, published
  decided_by       TEXT,
  decided_at       TIMESTAMPTZ,

  -- Anti-abuse only. Never displayed, never used to identify anyone.
  ip_hash          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT challenge_status_check
    CHECK (status IN ('received','reviewing','upheld','partially_upheld','not_upheld','withdrawn')),
  -- A decision has to say why. An outcome of "not upheld" with no reasoning is
  -- worse than no process, because it looks like one.
  CONSTRAINT challenge_decision_has_reason
    CHECK (
      status IN ('received','reviewing','withdrawn')
      OR (outcome IS NOT NULL AND length(btrim(outcome)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_challenges_status  ON figure_challenges(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_series  ON figure_challenges(series_type_id, period);

ALTER TABLE figure_challenges ENABLE ROW LEVEL SECURITY;
-- No policy. Public submission goes through the API on the service role key;
-- there is no browser-side Supabase client in this codebase.

COMMENT ON TABLE figure_challenges IS
  'Public challenges to published figures. The outcome is published whether or not the challenge succeeds.';

-- Verify:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid IN ('unfreeze_requests'::regclass, 'figure_challenges'::regclass);
