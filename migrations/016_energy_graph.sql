-- ── 016: Energy Knowledge Graph — nodes + edges ─────────────────────────────
-- A generic property-graph model on plain Postgres. Nodes are typed entities
-- (fuel, genco, transmission, disco, state, policy); edges are typed, weighted
-- relationships. This is the in-house, subscription-free alternative to a
-- dedicated graph database for the National Energy Knowledge Graph.
--
-- Traversal is done with WITH RECURSIVE (see /api/graph/trace); graph algorithms
-- (degree centrality, single points of failure) are computed in lib/graph-model.ts.

CREATE TABLE IF NOT EXISTS graph_nodes (
  id         BIGSERIAL PRIMARY KEY,
  node_key   TEXT NOT NULL UNIQUE,          -- stable slug, e.g. 'genco_egbin'
  label      TEXT NOT NULL,                 -- display name, e.g. 'Egbin Power'
  node_type  TEXT NOT NULL
    CHECK (node_type IN ('fuel','genco','transmission','disco','state','policy')),
  meta       JSONB,                         -- {capacity_mw, state, status, ...}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id         BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL REFERENCES graph_nodes(node_key) ON DELETE CASCADE,
  target_key TEXT NOT NULL REFERENCES graph_nodes(node_key) ON DELETE CASCADE,
  edge_type  TEXT NOT NULL
    CHECK (edge_type IN ('fuel_supply','generates','wheels','distributes','governs')),
  weight     NUMERIC(18,2) DEFAULT 1,       -- MW, share, or salience
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_key, target_key, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_key);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_key);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type   ON graph_nodes(node_type);

ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_nodes" ON graph_nodes FOR SELECT USING (true);
CREATE POLICY "public_read_edges" ON graph_edges FOR SELECT USING (true);
CREATE POLICY "service_nodes" ON graph_nodes USING (true) WITH CHECK (true);
CREATE POLICY "service_edges" ON graph_edges USING (true) WITH CHECK (true);

-- ── Seed: nodes ──────────────────────────────────────────────────────────────
INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
-- Fuels / primary energy
('fuel_gas','Natural Gas','fuel','{"unit":"MMscf"}'),
('fuel_hydro','Hydro','fuel','{"renewable":true}'),
('fuel_solar','Solar','fuel','{"renewable":true}'),
('fuel_diesel','Diesel / AGO','fuel','{"backup":true}'),
('fuel_coal','Coal','fuel','{}'),
-- Generation (major plants)
('genco_egbin','Egbin Power','genco','{"capacity_mw":1320,"state":"Lagos","fuel":"gas"}'),
('genco_kainji','Kainji Hydro','genco','{"capacity_mw":760,"state":"Niger","fuel":"hydro"}'),
('genco_jebba','Jebba Hydro','genco','{"capacity_mw":578,"state":"Niger","fuel":"hydro"}'),
('genco_shiroro','Shiroro Hydro','genco','{"capacity_mw":600,"state":"Niger","fuel":"hydro"}'),
('genco_zungeru','Zungeru Hydro','genco','{"capacity_mw":700,"state":"Niger","fuel":"hydro"}'),
('genco_afam','Afam VI','genco','{"capacity_mw":650,"state":"Rivers","fuel":"gas"}'),
('genco_azura','Azura-Edo IPP','genco','{"capacity_mw":461,"state":"Edo","fuel":"gas"}'),
('genco_delta','Delta (Ughelli)','genco','{"capacity_mw":900,"state":"Delta","fuel":"gas"}'),
('genco_okpai','Okpai','genco','{"capacity_mw":900,"state":"Delta","fuel":"gas"}'),
('genco_sapele','Sapele','genco','{"capacity_mw":1020,"state":"Delta","fuel":"gas"}'),
('genco_omotosho','Omotosho','genco','{"capacity_mw":500,"state":"Ondo","fuel":"gas"}'),
('genco_olorunsogo','Olorunsogo','genco','{"capacity_mw":750,"state":"Ogun","fuel":"gas"}'),
-- Transmission
('tcn','Transmission Company of Nigeria','transmission','{"role":"national_grid"}'),
-- Distribution companies
('disco_abuja','Abuja DisCo','disco','{}'),
('disco_benin','Benin DisCo','disco','{}'),
('disco_eko','Eko DisCo','disco','{}'),
('disco_enugu','Enugu DisCo','disco','{}'),
('disco_ibadan','Ibadan DisCo','disco','{}'),
('disco_ikeja','Ikeja DisCo','disco','{}'),
('disco_jos','Jos DisCo','disco','{}'),
('disco_kaduna','Kaduna DisCo','disco','{}'),
('disco_kano','Kano DisCo','disco','{}'),
('disco_ph','Port Harcourt DisCo','disco','{}'),
('disco_yola','Yola DisCo','disco','{}'),
-- States (demand centres)
('state_lagos','Lagos','state','{}'),
('state_fct','FCT Abuja','state','{}'),
('state_rivers','Rivers','state','{}'),
('state_kano','Kano','state','{}'),
('state_kaduna','Kaduna','state','{}'),
('state_oyo','Oyo','state','{}'),
('state_edo','Edo','state','{}'),
('state_enugu','Enugu','state','{}'),
('state_plateau','Plateau','state','{}'),
('state_adamawa','Adamawa','state','{}'),
-- Policy instruments
('policy_pia','Petroleum Industry Act 2021','policy','{}'),
('policy_necal','NECAL2050 Model','policy','{}'),
('policy_lpg','National LPG Expansion Programme','policy','{}'),
('policy_renewable','National Renewable Energy Action Plan','policy','{}')
ON CONFLICT (node_key) DO NOTHING;

-- ── Seed: edges ──────────────────────────────────────────────────────────────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
-- fuel → genco (fuel_supply, weight = plant capacity MW)
('fuel_gas','genco_egbin','fuel_supply',1320),
('fuel_gas','genco_afam','fuel_supply',650),
('fuel_gas','genco_azura','fuel_supply',461),
('fuel_gas','genco_delta','fuel_supply',900),
('fuel_gas','genco_okpai','fuel_supply',900),
('fuel_gas','genco_sapele','fuel_supply',1020),
('fuel_gas','genco_omotosho','fuel_supply',500),
('fuel_gas','genco_olorunsogo','fuel_supply',750),
('fuel_hydro','genco_kainji','fuel_supply',760),
('fuel_hydro','genco_jebba','fuel_supply',578),
('fuel_hydro','genco_shiroro','fuel_supply',600),
('fuel_hydro','genco_zungeru','fuel_supply',700),
-- genco → TCN (generates)
('genco_egbin','tcn','generates',1320),
('genco_kainji','tcn','generates',760),
('genco_jebba','tcn','generates',578),
('genco_shiroro','tcn','generates',600),
('genco_zungeru','tcn','generates',700),
('genco_afam','tcn','generates',650),
('genco_azura','tcn','generates',461),
('genco_delta','tcn','generates',900),
('genco_okpai','tcn','generates',900),
('genco_sapele','tcn','generates',1020),
('genco_omotosho','tcn','generates',500),
('genco_olorunsogo','tcn','generates',750),
-- TCN → disco (wheels)
('tcn','disco_abuja','wheels',1),
('tcn','disco_benin','wheels',1),
('tcn','disco_eko','wheels',1),
('tcn','disco_enugu','wheels',1),
('tcn','disco_ibadan','wheels',1),
('tcn','disco_ikeja','wheels',1),
('tcn','disco_jos','wheels',1),
('tcn','disco_kaduna','wheels',1),
('tcn','disco_kano','wheels',1),
('tcn','disco_ph','wheels',1),
('tcn','disco_yola','wheels',1),
-- disco → state (distributes)
('disco_eko','state_lagos','distributes',1),
('disco_ikeja','state_lagos','distributes',1),
('disco_abuja','state_fct','distributes',1),
('disco_ph','state_rivers','distributes',1),
('disco_kano','state_kano','distributes',1),
('disco_kaduna','state_kaduna','distributes',1),
('disco_ibadan','state_oyo','distributes',1),
('disco_benin','state_edo','distributes',1),
('disco_enugu','state_enugu','distributes',1),
('disco_jos','state_plateau','distributes',1),
('disco_yola','state_adamawa','distributes',1),
-- policy → asset (governs)
('policy_pia','fuel_gas','governs',1),
('policy_pia','genco_egbin','governs',1),
('policy_necal','tcn','governs',1),
('policy_renewable','fuel_solar','governs',1),
('policy_renewable','fuel_hydro','governs',1),
('policy_lpg','fuel_gas','governs',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;
