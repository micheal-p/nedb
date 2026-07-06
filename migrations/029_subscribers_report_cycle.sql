-- ── 029: Public subscribers + 31-day report cycle state ─────────────────────
-- Visitors subscribe with an email; staff work emails come from staff_users.
-- report_state holds the fixed 31-day cadence anchor: manual early pushes send
-- immediately but NEVER move the anchor — the automatic timeline stays intact.

CREATE TABLE IF NOT EXISTS subscribers (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  subscribed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_subscribers" ON subscribers;
CREATE POLICY "service_subscribers" ON subscribers USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS report_state (
  id             INT PRIMARY KEY CHECK (id = 1),   -- single row
  anchor_at      TIMESTAMPTZ NOT NULL,             -- start of the current 31-day cycle
  last_sent_at   TIMESTAMPTZ,
  last_sent_via  TEXT,                             -- 'scheduled' | 'manual'
  last_sent_count INT
);

ALTER TABLE report_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_report_state" ON report_state;
CREATE POLICY "service_report_state" ON report_state USING (true) WITH CHECK (true);

INSERT INTO report_state (id, anchor_at) VALUES (1, now())
ON CONFLICT (id) DO NOTHING;
