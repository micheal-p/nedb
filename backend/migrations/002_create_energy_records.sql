CREATE TABLE IF NOT EXISTS energy_records (
  id                  BIGSERIAL PRIMARY KEY,
  series_type_id      TEXT NOT NULL REFERENCES series_types(id),
  period              TEXT NOT NULL,
  period_date         DATE NOT NULL,
  region              TEXT NOT NULL DEFAULT 'NGA',
  fuel_product        TEXT,
  value               NUMERIC(20,4),
  unit                TEXT NOT NULL,
  source              TEXT,
  notes               TEXT,
  methodology_version TEXT NOT NULL DEFAULT 'v1',
  upload_session_id   BIGINT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_series_date ON energy_records(series_type_id, period_date);
CREATE INDEX IF NOT EXISTS idx_records_region ON energy_records(region);
