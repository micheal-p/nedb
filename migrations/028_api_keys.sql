-- ── 028: Public API keys — for researchers, media and partner agencies ──────
CREATE TABLE IF NOT EXISTS api_keys (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,          -- "nedb_" + random hex
  label      TEXT NOT NULL,                 -- "Premium Times data desk"
  owner      TEXT,                          -- contact person / email
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used  TIMESTAMPTZ
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_api_keys" ON api_keys USING (true) WITH CHECK (true);
