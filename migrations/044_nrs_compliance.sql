-- ── 044: NRS compliance ledger, telemetry and reconciliation ───────────────
-- The revenue question a tax authority actually asks is not "what did the
-- sector produce" but "does what this company DECLARED reconcile with what it
-- produced, what it sold, what it exported, and what it paid".
--
-- Three pieces:
--   company_declarations — one filed figure per company / OML / period / kind,
--     appended to a hash chain so the record is tamper-evident. A declaration
--     is never updated in place; a correction is a new entry that supersedes.
--   telemetry_readings   — device-level readings from metered facilities,
--     the independent measurement the declarations are checked against.
--   reconciliation_runs  — the stored outcome of a reconciliation, so a
--     finding can be cited later exactly as it stood.
--
-- Amounts are carried in BOTH naira and dollars with the FX rate that was used,
-- because an upstream sale is priced in dollars while the tax is assessed in
-- naira, and a reconciliation that silently picks one currency is wrong.

CREATE TABLE IF NOT EXISTS company_declarations (
  id            BIGSERIAL PRIMARY KEY,
  company_id    BIGINT REFERENCES companies_registry(id) ON DELETE RESTRICT,
  company_name  TEXT NOT NULL,
  oml_block     TEXT,                                  -- NULL = company-wide
  period        TEXT NOT NULL,                         -- YYYY-MM or YYYY-QN
  period_date   DATE NOT NULL,
  kind          TEXT NOT NULL,                         -- production | sales | export | tax_paid | royalty_paid
  volume        NUMERIC,                               -- barrels, Bcf, MT …
  volume_unit   TEXT,
  value_usd     NUMERIC,
  value_ngn     NUMERIC,
  fx_rate       NUMERIC,                               -- NGN per USD used for this filing
  source        TEXT,                                  -- filing reference / document id
  notes         TEXT,

  -- Tamper-evident chain
  seq           BIGINT NOT NULL,                       -- position in the chain
  prev_hash     TEXT NOT NULL,
  row_hash      TEXT NOT NULL,

  supersedes_id BIGINT REFERENCES company_declarations(id) ON DELETE SET NULL,
  filed_by      TEXT NOT NULL,
  filed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_decl_seq  ON company_declarations(seq);
CREATE INDEX IF NOT EXISTS idx_decl_lookup      ON company_declarations(company_name, period, kind);
CREATE INDEX IF NOT EXISTS idx_decl_period_date ON company_declarations(period_date DESC);

-- Independent measurement: metered readings from registered facilities.
CREATE TABLE IF NOT EXISTS telemetry_readings (
  id            BIGSERIAL PRIMARY KEY,
  device_id     TEXT NOT NULL,
  company_name  TEXT,
  oml_block     TEXT,
  reading_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  period        TEXT NOT NULL,
  metric        TEXT NOT NULL,                         -- production | flare | export_flow
  value         NUMERIC NOT NULL,
  unit          TEXT NOT NULL,
  quality       TEXT NOT NULL DEFAULT 'ok',            -- ok | suspect | missing
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_lookup ON telemetry_readings(company_name, period, metric);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id            BIGSERIAL PRIMARY KEY,
  period        TEXT NOT NULL,
  fx_rate       NUMERIC,
  findings      JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_checked INT NOT NULL DEFAULT 0,
  total_flagged INT NOT NULL DEFAULT 0,
  run_by        TEXT,
  run_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE company_declarations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_readings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_company_declarations" ON company_declarations USING (true) WITH CHECK (true);
CREATE POLICY "service_role_telemetry_readings"   ON telemetry_readings   USING (true) WITH CHECK (true);
CREATE POLICY "service_role_reconciliation_runs"  ON reconciliation_runs  USING (true) WITH CHECK (true);
