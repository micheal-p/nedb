CREATE TABLE IF NOT EXISTS validation_errors (
  id              BIGSERIAL PRIMARY KEY,
  session_id      BIGINT NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  row_number      INT NOT NULL,
  column_name     TEXT NOT NULL,
  error_type      TEXT NOT NULL,
  error_message   TEXT NOT NULL,
  raw_value       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
