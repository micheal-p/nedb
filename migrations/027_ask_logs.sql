-- ── 027: Apex AI question log — powers the admin usage panel ─────────────────
CREATE TABLE IF NOT EXISTS ask_logs (
  id          BIGSERIAL PRIMARY KEY,
  asked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip          TEXT,
  question    TEXT NOT NULL,
  status      TEXT NOT NULL,            -- ok | ai_quota | chat_rate_limit | error
  sources     INT  NOT NULL DEFAULT 0,  -- document chunks cited
  duration_ms INT
);
CREATE INDEX IF NOT EXISTS idx_ask_logs_time ON ask_logs (asked_at DESC);

ALTER TABLE ask_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_ask_logs" ON ask_logs USING (true) WITH CHECK (true);
