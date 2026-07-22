-- ── 036: NBS benchmarks — admin-editable population & poverty references ─────
-- Run in the Supabase SQL editor after 035.
--
-- Powers PENA coverage ("responses per 100,000 residents") and the poverty
-- benchmark on the drill-down map and state summary. Admins edit these at
-- /admin/pena/benchmarks; the app falls back to built-in defaults until this
-- table has rows. lga_name = '' means a state-level row; state_name='NIGERIA'
-- with lga_name='' is the national population row.
--
-- Seeded values: national population = UN World Population Prospects 2024
-- revision, mid-2026 estimate (242.43m), distributed across states by their
-- NPC/NBS 2006 census shares (no newer official per-state census exists);
-- poverty_rate = NBS NLSS 2018/19 poverty headcount (%). Borno's NLSS rate
-- was not published (partially surveyed).

CREATE TABLE IF NOT EXISTS nbs_benchmarks (
  id           BIGSERIAL PRIMARY KEY,
  state_name   TEXT NOT NULL,
  lga_name     TEXT NOT NULL DEFAULT '',   -- '' = state-level row
  population   BIGINT,
  poverty_rate NUMERIC,
  source       TEXT,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (state_name, lga_name)
);

ALTER TABLE nbs_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_nbs_benchmarks" ON nbs_benchmarks FOR SELECT USING (true);
CREATE POLICY "service_role_nbs_benchmarks" ON nbs_benchmarks USING (true) WITH CHECK (true);

INSERT INTO nbs_benchmarks (state_name, population, poverty_rate, source) VALUES
  ('NIGERIA',                   242430000, 40.1, 'UN World Population Prospects 2024, mid-2026 estimate; NLSS 2018/19 national headcount'),
  ('Abia', 4891000, 30.7, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Adamawa', 5471000, 75.4, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Akwa Ibom', 6767000, 26.8, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Anambra', 7219000, 14.8, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Bauchi', 8074000, 61.5, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Bayelsa', 2940000, 22.6, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Benue', 7283000, 32.9, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Borno', 7166000, NULL, 'UN WPP 2024 (mid-2026) by census shares; NLSS rate not published'),
  ('Cross River', 4987000, 36.3, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Delta', 7074000, 6.0, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Ebonyi', 3753000, 79.8, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Edo', 5555000, 12.0, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Ekiti', 4116000, 28.0, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Enugu', 5623000, 58.1, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Gombe', 4064000, 62.3, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Imo', 6793000, 28.9, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Jigawa', 7506000, 87.0, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Kaduna', 10472000, 43.5, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Kano', 16200000, 55.1, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Katsina', 9999000, 56.4, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Kebbi', 5592000, 50.2, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Kogi', 5659000, 28.5, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Kwara', 4093000, 20.4, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Lagos', 15561000, 4.5, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Nasarawa', 3216000, 57.3, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Niger', 6819000, 66.1, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Ogun', 6436000, 9.3, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Ondo', 5940000, 12.5, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Osun', 5909000, 8.5, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Oyo', 9652000, 9.8, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Plateau', 5488000, 55.1, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Rivers', 8951000, 23.9, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Sokoto', 6382000, 87.7, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Taraba', 3971000, 87.7, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Yobe', 4009000, 72.3, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Zamfara', 5628000, 74.0, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19'),
  ('Federal Capital Territory', 2425000, 38.7, 'UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19')
ON CONFLICT (state_name, lga_name) DO NOTHING;
