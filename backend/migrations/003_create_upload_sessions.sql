CREATE TABLE IF NOT EXISTS upload_sessions (
  id              BIGSERIAL PRIMARY KEY,
  series_type_id  TEXT NOT NULL REFERENCES series_types(id),
  filename        TEXT NOT NULL,
  row_count       INT  NOT NULL DEFAULT 0,
  error_count     INT  NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  uploaded_by     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
