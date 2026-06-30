-- Run in Supabase SQL Editor → paste and run
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies_registry (
  id            BIGSERIAL PRIMARY KEY,
  company       TEXT NOT NULL,
  oml_blocks    TEXT,
  operator_type TEXT NOT NULL,  -- National | IOC JV | Indigenous | PSC
  sector        TEXT NOT NULL DEFAULT 'Upstream',
  status        TEXT NOT NULL DEFAULT 'Active',
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE companies_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read registry" ON companies_registry FOR SELECT USING (true);

INSERT INTO companies_registry (company, oml_blocks, operator_type, sector, status, created_by) VALUES
  ('NNPC Ltd',          'OML 118, 119, 130',    'National',   'Upstream', 'Active', 'system'),
  ('Shell SPDC',        'OML 11, 17, 21, 22',   'IOC JV',     'Upstream', 'Active', 'system'),
  ('TotalEnergies EP',  'OML 58, 99, 100',       'IOC JV',     'Upstream', 'Active', 'system'),
  ('Chevron Nigeria',   'OML 49, 90, 91',        'IOC JV',     'Upstream', 'Active', 'system'),
  ('Seplat Energy',     'OML 4, 38, 41',         'Indigenous', 'Upstream', 'Active', 'system'),
  ('Oando PLC',         'OML 60, 61, 62, 63',    'Indigenous', 'Upstream', 'Active', 'system')
ON CONFLICT DO NOTHING;
