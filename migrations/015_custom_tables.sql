-- ── 015: Custom table builder ─────────────────────────────────────────────────
-- Lets staff create entirely new data series with user-defined columns.
-- Three tables:
--   custom_series   — the series header (name, slug, description)
--   custom_columns  — column definitions per series (type, auto-fill rules)
--   custom_records  — the actual data rows (stored as JSONB for flexibility)
--
-- The CBN auto-rate column is handled by setting column type = 'cbn_rate'.
-- The API route reads this flag and populates the value from the CBN API
-- before writing — staff never enter this field manually.

-- ── custom_series ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_series (
  id            BIGSERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,    -- auto-generated from name, e.g. crude_production_sale
  name          TEXT NOT NULL,           -- display name, e.g. "CRUDE PRODUCTION SALES"
  description   TEXT,
  what_is       TEXT,
  how_to_read   TEXT,
  why_it_matters TEXT,
  geo_resolution TEXT NOT NULL DEFAULT 'national'
    CHECK (geo_resolution IN ('national','state','lga')),
  is_public     BOOLEAN NOT NULL DEFAULT true,  -- shows on public portal
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── custom_columns ────────────────────────────────────────────────────────────
-- column_type controls rendering, validation, and auto-fill behaviour:
--   text        — free text
--   numeric     — decimal number with optional unit
--   date        — ISO date picker
--   select      — one of a predefined list (options stored in config JSONB)
--   cbn_rate    — auto-filled from CBN API at time of record creation (readonly)
--   lga_ref     — foreign key into the lgas table (renders as searchable LGA picker)
--   state_ref   — state code (ISO 3166-2:NG)

CREATE TABLE IF NOT EXISTS custom_columns (
  id            BIGSERIAL PRIMARY KEY,
  series_id     BIGINT NOT NULL REFERENCES custom_series(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,           -- display label, e.g. "Buyer / Recipient"
  slug          TEXT NOT NULL,           -- field key in custom_records JSONB
  column_type   TEXT NOT NULL DEFAULT 'text'
    CHECK (column_type IN ('text','numeric','date','select','cbn_rate','lga_ref','state_ref')),
  unit          TEXT,                    -- e.g. "barrels", "metric tonnes", "USD"
  is_required   BOOLEAN NOT NULL DEFAULT true,
  is_readonly   BOOLEAN NOT NULL DEFAULT false,  -- true for cbn_rate columns
  config        JSONB,                   -- for select: {"options":["A","B","C"]}
                                         -- for numeric: {"min":0,"max":null,"decimals":4}
  display_order INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, slug)
);

-- ── custom_records ────────────────────────────────────────────────────────────
-- Each row stores all field values as JSONB keyed by column slug.
-- e.g. {"date":"2025-01-15","buyer":"NNPC","barrels":1250000,
--        "usd_rate_at_sale":75.50,"cbn_rate":1621.50}
-- period_date is extracted for ordering and chart rendering.

CREATE TABLE IF NOT EXISTS custom_records (
  id               BIGSERIAL PRIMARY KEY,
  series_id        BIGINT NOT NULL REFERENCES custom_series(id) ON DELETE CASCADE,
  period_date      DATE NOT NULL,        -- extracted from the date column for ordering
  region           TEXT DEFAULT 'NGA',   -- ISO 3166-2:NG state code or NGA
  lga_id           BIGINT REFERENCES lgas(id),
  data             JSONB NOT NULL,       -- all column values keyed by slug
  upload_session_id BIGINT,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_records_series     ON custom_records(series_id);
CREATE INDEX IF NOT EXISTS idx_custom_records_period     ON custom_records(series_id, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_custom_records_lga        ON custom_records(lga_id) WHERE lga_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_records_data       ON custom_records USING GIN(data);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE custom_series  ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_records ENABLE ROW LEVEL SECURITY;

-- Public can read series and columns marked is_public = true
CREATE POLICY "public_read_custom_series"
  ON custom_series FOR SELECT
  USING (is_public = true);

CREATE POLICY "public_read_custom_columns"
  ON custom_columns FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM custom_series s
    WHERE s.id = custom_columns.series_id AND s.is_public = true
  ));

CREATE POLICY "public_read_custom_records"
  ON custom_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM custom_series s
    WHERE s.id = custom_records.series_id AND s.is_public = true
  ));

-- Service role has full access
CREATE POLICY "service_role_custom_series"
  ON custom_series USING (true) WITH CHECK (true);

CREATE POLICY "service_role_custom_columns"
  ON custom_columns USING (true) WITH CHECK (true);

CREATE POLICY "service_role_custom_records"
  ON custom_records USING (true) WITH CHECK (true);

-- ── Seed: CRUDE PRODUCTION SALES (example of the user's described series) ─────
INSERT INTO custom_series (slug, name, description, what_is, how_to_read, why_it_matters, geo_resolution, is_public, created_by)
VALUES (
  'crude_production_sale',
  'CRUDE PRODUCTION SALES',
  'Records of crude oil sales transactions — buyer, volume in barrels, the exchange rate at point of sale, and the live CBN rate at the time of entry.',
  'Each record represents a single crude oil sale transaction, capturing the buyer, the volume lifted in barrels, the USD rate agreed at the point of sale, and the CBN official exchange rate automatically recorded at the time of data entry.',
  'Compare the USD rate at sale against the CBN rate to understand the premium or discount at which each transaction was executed. Higher barrels with a favourable rate indicates strong revenue performance.',
  'Crude sales are the primary source of Nigeria''s foreign exchange earnings. Tracking each transaction with its exchange rate provides an auditable record of how oil revenue translates into naira at different points in time.',
  'national',
  true,
  'system'
);

-- Seed its columns
INSERT INTO custom_columns (series_id, name, slug, column_type, unit, is_required, is_readonly, config, display_order)
SELECT
  s.id,
  col.name, col.slug, col.column_type, col.unit, col.is_required, col.is_readonly, col.config::jsonb, col.display_order
FROM custom_series s
CROSS JOIN (VALUES
  ('Date of Sale',              'date',              'date',     NULL,       true,  false, '{"format":"YYYY-MM-DD"}',    1),
  ('Buyer / Recipient',         'buyer',             'text',     NULL,       true,  false, NULL,                          2),
  ('Volume (Barrels)',          'barrels',           'numeric',  'barrels',  true,  false, '{"min":0,"decimals":0}',      3),
  ('USD Rate at Point of Sale', 'usd_rate_at_sale',  'numeric',  'USD/NGN',  true,  false, '{"min":0,"decimals":4}',      4),
  ('CBN Rate (Auto)',           'cbn_rate',          'cbn_rate', 'USD/NGN',  true,  true,  NULL,                          5)
) AS col(name, slug, column_type, unit, is_required, is_readonly, config, display_order)
WHERE s.slug = 'crude_production_sale';
