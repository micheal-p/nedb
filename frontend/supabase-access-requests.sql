-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS access_requests (
  id            BIGSERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  organisation  TEXT NOT NULL,
  position      TEXT,
  profile_key   TEXT NOT NULL DEFAULT 'executive',
  justification TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  temp_username TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_email  ON access_requests(email);

ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; public can only INSERT (request), not read
CREATE POLICY "insert_request" ON access_requests FOR INSERT WITH CHECK (true);
