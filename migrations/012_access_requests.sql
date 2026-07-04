-- 012 — Portal access requests (from /portal page)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS access_requests (
  id            BIGSERIAL PRIMARY KEY,
  full_name     TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  organisation  TEXT        NOT NULL,
  position      TEXT,
  profile_key   TEXT        NOT NULL,
  justification TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  temp_username TEXT,                                    -- set when approved → staff_users account created
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status     ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_created_at ON access_requests(created_at DESC);

-- RLS: admins see all; public cannot read
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full" ON access_requests USING (true) WITH CHECK (true);
