-- Run all of these in Supabase → SQL Editor in order
-- ─────────────────────────────────────────────────────

-- 001: Series types
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

-- 002: Energy records
CREATE TABLE IF NOT EXISTS energy_records (
  id                  BIGSERIAL PRIMARY KEY,
  series_type_id      TEXT NOT NULL REFERENCES series_types(id),
  period              TEXT NOT NULL,
  period_date         DATE NOT NULL,
  region              TEXT DEFAULT 'NGA',
  fuel_product        TEXT,
  value               NUMERIC(20,4),
  unit                TEXT NOT NULL,
  source              TEXT,
  notes               TEXT,
  methodology_version TEXT DEFAULT 'v1',
  upload_session_id   BIGINT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_records_series_date ON energy_records(series_type_id, period_date);
CREATE INDEX IF NOT EXISTS idx_records_region ON energy_records(region);

-- 003: Upload sessions (with validated_rows JSONB for stateless serverless)
CREATE TABLE IF NOT EXISTS upload_sessions (
  id              BIGSERIAL PRIMARY KEY,
  series_type_id  TEXT NOT NULL REFERENCES series_types(id),
  filename        TEXT NOT NULL,
  row_count       INT  NOT NULL DEFAULT 0,
  error_count     INT  NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  uploaded_by     TEXT,
  validated_rows  JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 004: Validation errors
CREATE TABLE IF NOT EXISTS validation_errors (
  id              BIGSERIAL PRIMARY KEY,
  session_id      BIGINT NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  row_number      INT NOT NULL,
  column_name     TEXT NOT NULL,
  error_type      TEXT NOT NULL,
  error_message   TEXT NOT NULL,
  raw_value       TEXT
);

-- 005: Staff users
CREATE TABLE IF NOT EXISTS staff_users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL DEFAULT 'staff',
  password_hash TEXT NOT NULL,
  agency        TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login    TIMESTAMPTZ
);

-- 006: Seed series types
INSERT INTO series_types (id, name, sector, subsector, unit_default, frequency, viz_types) VALUES
  ('crude_oil_production',    'Crude Oil Production',           'petroleum',    'upstream',    'Barrels',        'monthly',   '{line,stacked-area,horizontal-bar}'),
  ('pms_sales',               'PMS (Petrol) Sales',             'petroleum',    'downstream',  'Litres',         'monthly',   '{line,horizontal-bar,heatmap}'),
  ('ago_sales',               'AGO (Diesel) Sales',             'petroleum',    'downstream',  'Litres',         'monthly',   '{line,horizontal-bar}'),
  ('lpg_sales',               'LPG Sales',                      'petroleum',    'downstream',  'Metric Tonnes',  'monthly',   '{line,horizontal-bar}'),
  ('natural_gas_production',  'Natural Gas Production',         'gas',          'upstream',    'MMSCFD',         'monthly',   '{line,stacked-area}'),
  ('electricity_generation',  'Electricity Generation',         'electricity',  'generation',  'GWh',            'monthly',   '{line,stacked-area,small-multiples}'),
  ('electricity_consumption', 'Electricity Consumption',        'electricity',  'consumption', 'GWh',            'monthly',   '{line,heatmap}'),
  ('electricity_sent_out',    'Electricity Sent Out',           'electricity',  'transmission','GWh',            'monthly',   '{line}'),
  ('installed_capacity',      'Installed Generation Capacity',  'electricity',  'generation',  'MW',             'annual',    '{line,horizontal-bar}'),
  ('fuelwood_consumption',    'Fuelwood Consumption',           'biomass',      NULL,          'Metric Tonnes',  'annual',    '{horizontal-bar}'),
  ('coal_production',         'Coal Production',                'solid_mineral',NULL,          'Tonnes',         'annual',    '{line,horizontal-bar}'),
  ('renewable_capacity',      'Renewable Energy Capacity',      'renewable',    NULL,          'MW',             'annual',    '{line,stacked-area}')
ON CONFLICT (id) DO NOTHING;

-- 007: Row Level Security — allow service role full access, deny anon
ALTER TABLE series_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users       ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically (used by Next.js API routes)
-- Public read on series_types and energy_records (the data is public)
CREATE POLICY "public read series"  ON series_types   FOR SELECT USING (true);
CREATE POLICY "public read records" ON energy_records  FOR SELECT USING (true);
