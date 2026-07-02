CREATE TABLE IF NOT EXISTS data_requests (
  id               BIGSERIAL PRIMARY KEY,
  full_name        TEXT NOT NULL,
  organization     TEXT,
  email            TEXT NOT NULL,
  purpose          TEXT NOT NULL,
  requested_series TEXT[] DEFAULT '{}',
  date_range       TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests(status);
