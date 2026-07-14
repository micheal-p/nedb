-- ── 030: NEDB as the graph's data backbone + NEIIA under ECN ──────────────────
-- Two structural facts the graph was missing:
--  1. NEDB itself is the platform this whole graph runs on — it should appear
--     as a node, cross-connected into every cluster (fuel, product, institution,
--     policy) so it sits at the visual centre of the force layout, not just
--     described in prose above the canvas.
--  2. NEIIA (nedb.energy) — and all nine of its products, NEDB included — is
--     organisationally under ECN. That reporting line was true but invisible.
--
-- New node_type: 'databank' (NEDB itself, one node), 'platform' (NEIIA + its
-- eight sibling products). New edge_type: 'tracks' (NEDB's data relationship
-- to the rest of the graph — distinct from 'operates', which is the ECN→NEIIA
-- org-chart line). NEDB is deliberately NOT wired in a way that makes it an
-- articulation point: removing it doesn't disconnect the physical grid, only
-- the data layer over it — that distinction is the honest one.

ALTER TABLE graph_nodes DROP CONSTRAINT IF EXISTS graph_nodes_node_type_check;
ALTER TABLE graph_nodes ADD CONSTRAINT graph_nodes_node_type_check
  CHECK (node_type IN ('fuel','genco','transmission','disco','state','policy',
                       'institution','terminal','refinery','gasplant','product','export',
                       'databank','platform'));

ALTER TABLE graph_edges DROP CONSTRAINT IF EXISTS graph_edges_edge_type_check;
ALTER TABLE graph_edges ADD CONSTRAINT graph_edges_edge_type_check
  CHECK (edge_type IN ('fuel_supply','generates','wheels','distributes','governs',
                       'regulates','supplies','produces','exports','operates','tracks'));

-- ── NEDB itself ───────────────────────────────────────────────────────────────
INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
('nedb','National Energy Databank (NEDB)','databank',
 '{"description":"ECN''s national energy statistics platform — the single source of truth this graph, the GraphRAG policy assistant, and the wider NEIIA ecosystem are all built on. Owned and operated by ECN.","operator":"Energy Commission of Nigeria"}')
ON CONFLICT (node_key) DO NOTHING;

-- ── NEIIA platform + its nine products (NEDB is one of the nine) ─────────────
INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
('neiia_platform','NEIIA Platform','platform',
 '{"description":"Centralized platform delivering energy investment intelligence, data and strategic insight for Nigeria''s energy sector. Nine core products coordinated as one system, operating under ECN oversight; NEDB is the data backbone the other eight read from."}'),
('neiia_nefund','NEFUND','platform',
 '{"description":"Investment fund management vehicle — routes capital to projects and SPVs across the NEIIA ecosystem."}'),
('neiia_evillage','eVillage','platform',
 '{"description":"Community-focused energy investment platform — feeds village-level projects into the broader capital marketplace."}'),
('neiia_dealroom','National Energy Deal Room','platform',
 '{"description":"Regulated equity marketplace for tokenised capital raises — growth capital, private placements and escrow (CSAFE, bonds, PPM, NIBSS escrow, data vault)."}'),
('neiia_assets','National Energy Assets','platform',
 '{"description":"Asset registry and tracking for energy infrastructure and investment assets — transparency for investors and oversight bodies."}'),
('neiia_apexai','Apex AI','platform',
 '{"description":"Intelligence and analytical engine (beta) — aggregates data from NEDB and the Deal Room to deliver predictive insights and decision support.","status":"beta"}'),
('neiia_riskesg','Risk & ESG Intelligence','platform',
 '{"description":"Environmental, social and governance analysis — informs investor due diligence and regulatory reporting."}'),
('neiia_reporting','Reporting & LP Portals','platform',
 '{"description":"Stakeholder communication and portfolio transparency — distributes fund performance and capital-deployment tracking to limited partners and government stakeholders."}'),
('neiia_admin','Administration & Governance','platform',
 '{"description":"Platform oversight, compliance and operational management — accountability across all NEIIA modules and external agencies."}')
ON CONFLICT (node_key) DO NOTHING;

-- ── Org-chart line: ECN → NEIIA → its eight sibling products; ECN → NEDB ────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('inst_ecn','neiia_platform','operates',1),
('inst_ecn','nedb','operates',1),
('neiia_platform','neiia_nefund','operates',1),
('neiia_platform','neiia_evillage','operates',1),
('neiia_platform','neiia_dealroom','operates',1),
('neiia_platform','neiia_assets','operates',1),
('neiia_platform','neiia_apexai','operates',1),
('neiia_platform','neiia_riskesg','operates',1),
('neiia_platform','neiia_reporting','operates',1),
('neiia_platform','neiia_admin','operates',1),
('neiia_platform','nedb','operates',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── NEDB's real data relationships within NEIIA (verified: it feeds these three) ─
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('nedb','neiia_apexai','tracks',1),
('nedb','neiia_riskesg','tracks',1),
('nedb','neiia_dealroom','tracks',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── NEDB tracks statistics across every cluster of the physical/regulatory graph ─
-- This is what earns NEDB the centre of the force layout honestly: it is the
-- one node touching fuel, transmission, product, institution and policy alike,
-- rather than being confined to a single corner of the network like TCN (grid)
-- or NUPRC (upstream) are. It deliberately does NOT touch every leaf node
-- (every DisCo, every state, every plant) — only the anchors each cluster's
-- statistics roll up through — so it reads as a data layer over the graph, not
-- a duplicate of it.
-- Note: fuel_diesel and fuel_coal are deliberately excluded — they carry no
-- other edges in the seed data, so wiring NEDB to them would make NEDB the
-- sole path keeping those two nodes connected, a false single-point-of-failure
-- artifact rather than a real one.
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('nedb','fuel_gas','tracks',1),
('nedb','fuel_hydro','tracks',1),
('nedb','fuel_solar','tracks',1),
('nedb','fuel_wind','tracks',1),
('nedb','tcn','tracks',1),
('nedb','product_crude','tracks',1),
('nedb','prod_pms','tracks',1),
('nedb','prod_ago','tracks',1),
('nedb','prod_dpk','tracks',1),
('nedb','prod_lpg','tracks',1),
('nedb','prod_lng','tracks',1),
('nedb','mid_nlng','tracks',1),
('nedb','inst_nerc','tracks',1),
('nedb','inst_nuprc','tracks',1),
('nedb','inst_nmdpra','tracks',1),
('nedb','inst_nnpc','tracks',1),
('nedb','policy_pia','tracks',1),
('nedb','policy_necal','tracks',1),
('nedb','policy_lpg','tracks',1),
('nedb','policy_renewable','tracks',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;
