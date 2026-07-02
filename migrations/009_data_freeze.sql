-- ── 009: Data freeze — lock published periods from editing ───────────────────

CREATE TABLE IF NOT EXISTS frozen_periods (
  id             BIGSERIAL PRIMARY KEY,
  series_type_id TEXT NOT NULL,
  period         TEXT NOT NULL,          -- e.g. "2023" | "2023-Q1" | "2023-01" | "*" for whole series
  frozen_by      TEXT NOT NULL,
  frozen_at      TIMESTAMPTZ DEFAULT now(),
  reason         TEXT,
  UNIQUE (series_type_id, period)
);

CREATE INDEX idx_frozen_series ON frozen_periods(series_type_id);

COMMENT ON TABLE frozen_periods IS
  'Admin-controlled lock table. Records matching series_type_id+period cannot be edited or deleted.
   Use period="*" to freeze an entire series.';
