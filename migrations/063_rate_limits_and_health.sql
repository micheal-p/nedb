-- ── 063: our own rate-limit rail, and a memory for health ───────────────────
-- Run after 062.
--
-- Production has never had Redis, so the "durable" limiter has been quietly
-- falling back to per-instance counters since launch. Instead of renting a
-- cache to count requests, the database counts them: an UNLOGGED table (fast,
-- expendable — losing counters on a crash is acceptable for a rate limit) and
-- one atomic upsert per hit. Redis, if it ever arrives, still takes priority.
--
-- Health gains a memory: /api/health snapshots itself (at most once a minute)
-- so the admin console can show uptime, latency and incidents from evidence
-- rather than vibes. The sampling is honest — gaps mean nobody asked, not
-- that the service was up.

CREATE UNLOGGED TABLE IF NOT EXISTS rate_limit_counters (
  key    TEXT   NOT NULL,
  bucket BIGINT NOT NULL,          -- floor(epoch / window) — window baked into the key
  count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, bucket)
);

CREATE OR REPLACE FUNCTION rl_hit(p_key TEXT, p_bucket BIGINT) RETURNS INTEGER AS $$
  INSERT INTO rate_limit_counters (key, bucket, count)
  VALUES (p_key, p_bucket, 1)
  ON CONFLICT (key, bucket) DO UPDATE SET count = rate_limit_counters.count + 1
  RETURNING count;
$$ LANGUAGE sql;

-- Opportunistic hygiene, called by the limiter itself now and then.
CREATE OR REPLACE FUNCTION rl_sweep(p_before BIGINT) RETURNS void AS $$
  DELETE FROM rate_limit_counters WHERE bucket < p_before;
$$ LANGUAGE sql;

CREATE TABLE IF NOT EXISTS health_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL,             -- ok | degraded | down
  db_ok        BOOLEAN,
  db_ms        INTEGER,
  cache_status TEXT,
  detail       JSONB
);
CREATE INDEX IF NOT EXISTS idx_health_snapshots_at ON health_snapshots(checked_at DESC);

ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_snapshots    ENABLE ROW LEVEL SECURITY;
