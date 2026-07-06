CREATE TABLE IF NOT EXISTS series_types (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  sector        TEXT NOT NULL,
  subsector     TEXT,
  unit_default  TEXT NOT NULL,
  frequency     TEXT NOT NULL DEFAULT 'annual',
  viz_types     TEXT[] NOT NULL DEFAULT '{line}',
  created_at    TIMESTAMPTZ DEFAULT now()
);
