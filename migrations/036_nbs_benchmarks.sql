-- ── 036: NBS benchmarks — admin-editable population & poverty references ─────
-- Run in the Supabase SQL editor after 035.
--
-- Powers PENA coverage ("responses per 100,000 residents") and the poverty
-- benchmark on the drill-down map and state summary. Admins edit these at
-- /admin/pena/benchmarks; the app falls back to built-in defaults until this
-- table has rows. lga_name = '' means a state-level row; state_name='NIGERIA'
-- with lga_name='' is the national population row.
--
-- Seeded values: population = NPC/NBS 2006 census projected to the NBS 2022
-- national estimate (216.8m) by census shares; poverty_rate = NBS NLSS
-- 2018/19 poverty headcount (%). Borno's NLSS rate was not published.

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
  ('NIGERIA',                   216783400, 40.1, 'NBS 2022 national projection; NLSS 2018/19 national headcount'),
  ('Abia',                        4373000, 30.7, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Adamawa',                     4892000, 75.4, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Akwa Ibom',                   6051000, 26.8, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Anambra',                     6456000, 14.8, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Bauchi',                      7220000, 61.5, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Bayelsa',                     2629000, 22.6, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Benue',                       6513000, 32.9, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Borno',                       6408000, NULL, 'NPC 2006 census proj. 2022; NLSS rate not published'),
  ('Cross River',                 4460000, 36.3, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Delta',                       6326000,  6.0, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Ebonyi',                      3356000, 79.8, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Edo',                         4968000, 12.0, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Ekiti',                       3680000, 28.0, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Enugu',                       5028000, 58.1, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Gombe',                       3634000, 62.3, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Imo',                         6074000, 28.9, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Jigawa',                      6712000, 87.0, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Kaduna',                      9364000, 43.5, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Kano',                       14486000, 55.1, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Katsina',                     8941000, 56.4, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Kebbi',                       5000000, 50.2, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Kogi',                        5060000, 28.5, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Kwara',                       3660000, 20.4, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Lagos',                      13915000,  4.5, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Nasarawa',                    2876000, 57.3, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Niger',                       6098000, 66.1, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Ogun',                        5755000,  9.3, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Ondo',                        5312000, 12.5, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Osun',                        5284000,  8.5, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Oyo',                         8631000,  9.8, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Plateau',                     4907000, 55.1, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Rivers',                      8004000, 23.9, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Sokoto',                      5707000, 87.7, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Taraba',                      3551000, 87.7, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Yobe',                        3584000, 72.3, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Zamfara',                     5032000, 74.0, 'NPC 2006 census proj. 2022; NLSS 2018/19'),
  ('Federal Capital Territory',   2169000, 38.7, 'NPC 2006 census proj. 2022; NLSS 2018/19')
ON CONFLICT (state_name, lga_name) DO NOTHING;
