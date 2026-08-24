-- ── 046: Access provisioning pipeline, and support tickets ─────────────────
--
-- ACCESS PIPELINE
-- Approving an access request used to be a single button that created an
-- account and hoped somebody remembered to send the credentials. Granting a
-- person sight of national energy data deserves a pipeline with stages you can
-- see, so a request can never sit in an ambiguous state and every transition
-- has an owner and a timestamp.
--
--   submitted → triage → review → approved → provisioned → active
--                            └──→ rejected      └──→ suspended
--
-- ACCESS SCOPE
-- An approval decides more than yes or no: which dashboard profile, whether
-- export is included, and when the grant expires. A grant with no expiry is a
-- grant nobody ever revisits.

ALTER TABLE access_requests
  ADD COLUMN IF NOT EXISTS stage        TEXT NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS assigned_to  TEXT,
  ADD COLUMN IF NOT EXISTS decision_note TEXT,
  ADD COLUMN IF NOT EXISTS granted_profile TEXT,
  ADD COLUMN IF NOT EXISTS can_export   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioned_username TEXT;

-- Every stage transition, so the pipeline has a history rather than a state.
CREATE TABLE IF NOT EXISTS access_request_events (
  id          BIGSERIAL PRIMARY KEY,
  request_id  BIGINT NOT NULL REFERENCES access_requests(id) ON DELETE CASCADE,
  from_stage  TEXT,
  to_stage    TEXT NOT NULL,
  note        TEXT,
  actor       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_events_req ON access_request_events(request_id, created_at);

-- ── SUPPORT TICKETS ────────────────────────────────────────────────────────
-- Staff hit problems inside the platform — a figure that looks wrong, an
-- upload that will not validate, access they need. Without somewhere to raise
-- it that lives next to the data, those reports arrive as phone calls and
-- disappear.
CREATE TABLE IF NOT EXISTS support_tickets (
  id           BIGSERIAL PRIMARY KEY,
  reference    TEXT UNIQUE,
  subject      TEXT NOT NULL,
  body         TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'other',   -- data_quality | access | upload | feature | other
  priority     TEXT NOT NULL DEFAULT 'normal',  -- low | normal | high
  status       TEXT NOT NULL DEFAULT 'open',    -- open | in_progress | resolved | closed
  -- Where the problem was seen, so it can be reproduced
  context_path TEXT,
  series_id    TEXT,
  period       TEXT,
  raised_by    TEXT NOT NULL,
  raised_name  TEXT,
  assigned_to  TEXT,
  resolution   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_raiser ON support_tickets(raised_by, created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id         BIGSERIAL PRIMARY KEY,
  ticket_id  BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  author     TEXT NOT NULL,
  is_staff   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies ON support_ticket_replies(ticket_id, created_at);

ALTER TABLE access_request_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_replies   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_access_events"   ON access_request_events  USING (true) WITH CHECK (true);
CREATE POLICY "service_role_tickets"         ON support_tickets        USING (true) WITH CHECK (true);
CREATE POLICY "service_role_ticket_replies"  ON support_ticket_replies USING (true) WITH CHECK (true);

-- Existing requests keep their meaning: approved rows are already provisioned.
UPDATE access_requests SET stage = 'active'   WHERE status = 'approved' AND stage = 'submitted';
UPDATE access_requests SET stage = 'rejected' WHERE status = 'rejected' AND stage = 'submitted';
