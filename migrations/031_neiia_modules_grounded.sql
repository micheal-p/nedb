-- ── 031: Ground every NEIIA module in what it actually does ───────────────────
-- Migration 030 added all 9 NEIIA products as nodes reporting to ECN, but only
-- wired NEDB itself into the physical/regulatory graph. This migration researches
-- each of the other 8 (fetched from neiia.energy and each product's own site)
-- and connects them to real energy-graph anchors — no product is left as a
-- disconnected org-chart leaf, and no connection is invented beyond what each
-- product's own description supports.
--
-- Also corrects a factual error from 030: National Energy Assets was described
-- as a physical asset registry. It is actually an NGX equities trading
-- simulator for listed energy & power stocks — description + connections fixed
-- below to match.
--
-- New edge_type: 'finances' (capital flow — fund/marketplace → what it funds),
-- 'displaces' (eVillage's clean-energy-vs-fossil-fuel displacement claim).
-- New node: Federal Ministry of Environment (regulates the ESG Clearance
-- product) — the one NEIIA module whose real counterpart institution wasn't
-- already in the graph.
--
-- Also: 024 deleted fuel_diesel (and fuel_coal) as orphans, on the stated
-- reasoning that they "should return only when off-grid/self-generation
-- modelling is added." eVillage's diesel-genset displacement is exactly that
-- case, so fuel_diesel is re-seeded here before anything references it.
-- fuel_coal is NOT re-added — nothing in this migration gives it a real edge.

ALTER TABLE graph_edges DROP CONSTRAINT IF EXISTS graph_edges_edge_type_check;
ALTER TABLE graph_edges ADD CONSTRAINT graph_edges_edge_type_check
  CHECK (edge_type IN ('fuel_supply','generates','wheels','distributes','governs',
                       'regulates','supplies','produces','exports','operates','tracks',
                       'finances','displaces'));

INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
('fuel_diesel','Diesel / AGO','fuel','{"backup":true,"description":"Off-grid backup and self-generation fuel — the fossil-fuel baseline eVillage''s solar/mini-grid financing is displacing at the household and community level."}')
ON CONFLICT (node_key) DO NOTHING;

-- ── Correct the National Energy Assets description (it's a trading simulator,
--    not a physical asset registry) ───────────────────────────────────────────
UPDATE graph_nodes SET meta = meta || '{"description":"NGX equities trading simulator for listed energy & power companies — real market data, virtual ₦5,000,000 starting balance. Not a physical asset registry."}'::jsonb
WHERE node_key = 'neiia_assets';

-- Enrich the other product descriptions with what each one actually does ─────
UPDATE graph_nodes SET meta = meta || '{"description":"National Energy Fund — target capitalisation US$100bn, lead-managed by JP Morgan and First Capital. Six sub-funds: Nuclear Energy, Rural Electrification (off-grid/mini-grid), Energy Efficiency, Innovation, Special Fund for Oil & Gas (indigenous upstream/midstream), Project Preparatory. Channels institutional, DFI and pension capital into Nigeria''s energy transition."}'::jsonb
WHERE node_key = 'neiia_nefund';

UPDATE graph_nodes SET meta = meta || '{"description":"Solar-first rural electrification financing — solar home systems and pay-as-you-go community mini-grids, funded through NEFUND with SHINE federal subsidy administration. Verified via BVN/NIN. Explicitly positioned as clean-energy displacement of diesel and kerosene generators, tracking tCO2e avoided."}'::jsonb
WHERE node_key = 'neiia_evillage';

UPDATE graph_nodes SET meta = meta || '{"description":"SEC Nigeria-licensed tokenised capital marketplace — Lane A (retail-open MSME growth-capital raises, N50m-N100m annual cap) and Lane B (qualified-only private placements). Instruments: CSAFE, convertible notes, equity, PPM, commercial paper, bonds, revenue share. Lists deals across renewable energy, oil & gas and other sectors; settlement via CBN-licensed custodians."}'::jsonb
WHERE node_key = 'neiia_dealroom';

UPDATE graph_nodes SET meta = meta || '{"description":"AI portfolio copilot (beta) — reads live Deal Room positions and commitments in natural language; tracks exposure/concentration, vintage benchmarks, pacing and realised-vs-paper returns. Position data stays within the tenant. Closed beta: 14 firms, 240+ positions analysed weekly."}'::jsonb
WHERE node_key = 'neiia_apexai';

UPDATE graph_nodes SET meta = meta || '{"description":"ESG Clearance certification service — mandatory compliance questionnaire plus Environmental Impact Assessment and Governance Charter submission, reviewed by NEIIA specialists and the Federal Ministry of Environment (~48hr avg review)."}'::jsonb
WHERE node_key = 'neiia_riskesg';

UPDATE graph_nodes SET meta = meta || '{"description":"Automated LP reporting — quarterly statements, KPIs and outlook pushed to every invested LP at the agreed cadence. Tracks capital calls, distributions, fees and carry across SPVs, sub-funds and co-investment vehicles. NEIIA never holds investor funds; settlement happens off-platform to the GP''s account."}'::jsonb
WHERE node_key = 'neiia_reporting';

UPDATE graph_nodes SET meta = meta || '{"description":"Nigerian Energy Stakeholder Map — interactive directory of ministries, regulators, operators and financiers across the energy sector, with a reporting-line hierarchy (Presidency to Ministries to Regulators to Operators). \"One source of truth for who runs what, where they sit, and how to reach them.\""}'::jsonb
WHERE node_key = 'neiia_admin';

-- ── New institution: the real regulator behind ESG Clearance ─────────────────
INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
('inst_moe','Federal Ministry of Environment','institution',
 '{"description":"Reviews and approves ESG Clearance applications submitted through NEIIA''s Risk & ESG product.","operator":"Federal Government of Nigeria"}')
ON CONFLICT (node_key) DO NOTHING;

-- ── NEFUND: its own stated sub-funds, wired to what they actually finance ────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('neiia_nefund','fuel_solar','finances',1),      -- Rural Electrification Fund
('neiia_nefund','fuel_hydro','finances',1),      -- "small- and large-scale energy generation"
('neiia_nefund','fuel_wind','finances',1),       -- "low-carbon energy infrastructure"
('neiia_nefund','fuel_gas','finances',1),        -- Special Fund for Oil & Gas
('neiia_nefund','neiia_evillage','finances',1),  -- "capital flows through NEFUND" into eVillage
('neiia_nefund','neiia_dealroom','finances',1),  -- deployed via specialised sub-funds into Deal Room raises
('neiia_nefund','neiia_reporting','tracks',1)    -- LP reporting on NEFUND's own capital activity
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── eVillage: solar/mini-grid financing, explicit diesel/kerosene displacement ─
-- fuel_diesel had zero edges anywhere in the graph before this migration, so
-- wiring eVillage to it alone would make eVillage the sole path keeping
-- fuel_diesel connected — the same false-SPOF shape avoided in 030. The honest
-- fix isn't to drop the edge (eVillage really does displace diesel gensets) —
-- it's to also add NEDB's own real tracking edge, since AGO/diesel consumption
-- is one of NEDB's actual published series (ago.html on the live site).
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('neiia_evillage','fuel_solar','finances',1),
('neiia_evillage','fuel_diesel','displaces',1),
('neiia_evillage','prod_dpk','displaces',1),
('policy_renewable','neiia_evillage','governs',1),
('nedb','fuel_diesel','tracks',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── Deal Room: its own listed deal sectors (renewable energy + oil & gas) ────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('neiia_dealroom','fuel_solar','finances',1),
('neiia_dealroom','product_crude','finances',1),
('neiia_dealroom','neiia_apexai','tracks',1)     -- Apex AI reads live Deal Room tenancy
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── National Energy Assets: the one real energy-sector NGX-listed equity
--    already in the graph (Geregu Power Plc) ────────────────────────────────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('neiia_assets','genco_geregu','tracks',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── Risk & ESG: the real regulator behind its clearance certificate ──────────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('inst_moe','neiia_riskesg','regulates',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── Administration & Governance: it IS a directory of these institutions ─────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('neiia_admin','inst_ecn','tracks',1),
('neiia_admin','inst_nerc','tracks',1),
('neiia_admin','inst_nuprc','tracks',1),
('neiia_admin','inst_nmdpra','tracks',1),
('neiia_admin','inst_nnpc','tracks',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;
