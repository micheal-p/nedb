CREATE TABLE IF NOT EXISTS anomaly_flags (
  id             BIGSERIAL PRIMARY KEY,
  record_id      BIGINT NOT NULL REFERENCES energy_records(id) ON DELETE CASCADE,
  series_type_id TEXT NOT NULL,
  period         TEXT NOT NULL,
  region         TEXT NOT NULL DEFAULT 'NGA',
  value          NUMERIC(20,4),
  mean_value     NUMERIC(20,4),
  stddev_value   NUMERIC(20,4),
  z_score        NUMERIC(10,4),
  reviewed       BOOLEAN NOT NULL DEFAULT false,
  reviewed_by    TEXT,
  reviewed_at    TIMESTAMPTZ,
  flagged_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_series    ON anomaly_flags(series_type_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_unreviewed ON anomaly_flags(reviewed) WHERE NOT reviewed;
