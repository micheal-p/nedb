-- ── 025: Broaden the graph beyond electricity — oil & gas chain + institutions ─
-- Adds the petroleum value chain (upstream export terminals → refineries/NLNG →
-- refined products → export markets) and the governing institutions (ECN, NERC,
-- NUPRC, NMDPRA, NNPC Ltd). All entities and capacities are publicly documented.
-- New relationship types: regulates, supplies, produces, exports, operates.

-- Expand type constraints
ALTER TABLE graph_nodes DROP CONSTRAINT IF EXISTS graph_nodes_node_type_check;
ALTER TABLE graph_nodes ADD CONSTRAINT graph_nodes_node_type_check
  CHECK (node_type IN ('fuel','genco','transmission','disco','state','policy',
                       'institution','terminal','refinery','gasplant','product','export'));

ALTER TABLE graph_edges DROP CONSTRAINT IF EXISTS graph_edges_edge_type_check;
ALTER TABLE graph_edges ADD CONSTRAINT graph_edges_edge_type_check
  CHECK (edge_type IN ('fuel_supply','generates','wheels','distributes','governs',
                       'regulates','supplies','produces','exports','operates'));

-- ── Institutions ──────────────────────────────────────────────────────────────
INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
('inst_ecn','Energy Commission of Nigeria (ECN)','institution','{"description":"The apex agency for strategic planning and coordination of national energy policy in all its ramifications (Act No. 62 of 1979, CAP. E10 LFN 2004). Owner of NECAL2050, the national energy statistics mandate, and this Data Bank. HQ: Plot 701C, Central Business District, Abuja. DG/CEO: Dr. Mustapha Abdullahi (since Oct 2023).","operator":"Federal Government of Nigeria"}'),
('inst_nerc','NERC','institution','{"description":"Nigerian Electricity Regulatory Commission — licenses and regulates the entire electricity market: generation, transmission and the eleven DisCos.","year":"2005"}'),
('inst_nuprc','NUPRC','institution','{"description":"Nigerian Upstream Petroleum Regulatory Commission — regulates all upstream oil and gas: acreage, drilling, production, royalties and export terminals. Created by the PIA 2021.","year":"2021"}'),
('inst_nmdpra','NMDPRA','institution','{"description":"Nigerian Midstream and Downstream Petroleum Regulatory Authority — regulates refineries, gas processing, depots, and the distribution of refined products. Created by the PIA 2021.","year":"2021"}'),
('inst_nnpc','NNPC Limited','institution','{"description":"The national oil company, incorporated as a limited company under the PIA 2021. Holds federation equity in upstream JVs and owns the Port Harcourt, Warri and Kaduna refineries.","year":"2021"}'),

-- ── Upstream: crude + major export terminals ─────────────────────────────────
('product_crude','Crude Oil','product','{"unit":"barrels","description":"Nigeria''s principal export commodity. Bonny Light, Forcados, Qua Iboe and Escravos are among its benchmark export grades."}'),
('term_bonny','Bonny Terminal','terminal','{"state":"Rivers","description":"One of Nigeria''s oldest and largest crude export terminals, on Bonny Island."}'),
('term_forcados','Forcados Terminal','terminal','{"state":"Delta","description":"Major crude export terminal serving the western Niger Delta."}'),
('term_quaiboe','Qua Iboe Terminal','terminal','{"state":"Akwa Ibom","description":"Export terminal for the Qua Iboe grade, near Eket."}'),
('term_escravos','Escravos Terminal','terminal','{"state":"Delta","description":"Crude export terminal at the Escravos river mouth."}'),
('term_brass','Brass Terminal','terminal','{"state":"Bayelsa","description":"Crude export terminal at Brass, Bayelsa State."}'),
('term_bonga','Bonga FPSO','terminal','{"state":"Deep offshore","description":"Nigeria''s first deepwater FPSO, producing and exporting the Bonga grade."}'),
('term_agbami','Agbami FPSO','terminal','{"state":"Deep offshore","description":"Deepwater floating production and export vessel for the Agbami field."}'),

-- ── Midstream: refineries + LNG ──────────────────────────────────────────────
('ref_dangote','Dangote Refinery','refinery','{"capacity_bpd":650000,"state":"Lagos","description":"650,000 bpd single-train refinery at Lekki — the largest in Africa. Began production 2024, supplying PMS, AGO, kerosene and LPG to the domestic market and export."}'),
('ref_ph','Port Harcourt Refinery','refinery','{"capacity_bpd":210000,"state":"Rivers","description":"NNPC refinery complex (60,000 + 150,000 bpd trains) at Alesa-Eleme; partially restreamed after rehabilitation.","operator":"NNPC Limited"}'),
('ref_warri','Warri Refinery','refinery','{"capacity_bpd":125000,"state":"Delta","description":"NNPC refinery and petrochemical plant; under rehabilitation.","operator":"NNPC Limited"}'),
('ref_kaduna','Kaduna Refinery','refinery','{"capacity_bpd":110000,"state":"Kaduna","description":"NNPC inland refinery designed for both Nigerian and imported heavy crude; under rehabilitation.","operator":"NNPC Limited"}'),
('mid_nlng','Nigeria LNG (Bonny)','gasplant','{"capacity_mtpa":22,"state":"Rivers","description":"Six-train liquefied natural gas plant on Bonny Island (~22 MTPA), one of the world''s major LNG suppliers. Train 7 under construction.","operator":"NLNG (NNPC/Shell/TotalEnergies/Eni JV)"}'),

-- ── Products + export market ─────────────────────────────────────────────────
('prod_pms','PMS (Petrol)','product','{"unit":"litres"}'),
('prod_ago','AGO (Diesel)','product','{"unit":"litres","description":"Diesel — refined product for transport and industrial self-generation. Connected here through the refining chain, not the power grid."}'),
('prod_dpk','DPK (Kerosene)','product','{"unit":"litres"}'),
('prod_lpg','LPG (Cooking Gas)','product','{"unit":"metric tonnes"}'),
('prod_lng','LNG','product','{"unit":"metric tonnes"}'),
('export_markets','Global Export Markets','export','{"description":"International buyers of Nigerian crude and LNG — the source of the foreign exchange earnings tracked in FAAC oil revenue."}')
ON CONFLICT (node_key) DO NOTHING;

-- ── Relationships ─────────────────────────────────────────────────────────────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
-- Crude flows: to terminals (export) and refineries (domestic processing)
('product_crude','term_bonny','supplies',1),
('product_crude','term_forcados','supplies',1),
('product_crude','term_quaiboe','supplies',1),
('product_crude','term_escravos','supplies',1),
('product_crude','term_brass','supplies',1),
('product_crude','term_bonga','supplies',1),
('product_crude','term_agbami','supplies',1),
('product_crude','ref_dangote','supplies',650000),
('product_crude','ref_ph','supplies',210000),
('product_crude','ref_warri','supplies',125000),
('product_crude','ref_kaduna','supplies',110000),
-- Terminals export
('term_bonny','export_markets','exports',1),
('term_forcados','export_markets','exports',1),
('term_quaiboe','export_markets','exports',1),
('term_escravos','export_markets','exports',1),
('term_brass','export_markets','exports',1),
('term_bonga','export_markets','exports',1),
('term_agbami','export_markets','exports',1),
-- Refineries produce products (operational refineries only)
('ref_dangote','prod_pms','produces',1),
('ref_dangote','prod_ago','produces',1),
('ref_dangote','prod_dpk','produces',1),
('ref_dangote','prod_lpg','produces',1),
('ref_ph','prod_pms','produces',1),
('ref_ph','prod_ago','produces',1),
('ref_ph','prod_dpk','produces',1),
-- Gas → NLNG → LNG → export
('fuel_gas','mid_nlng','supplies',1),
('mid_nlng','prod_lng','produces',1),
('mid_nlng','export_markets','exports',1),
-- Regulation
('inst_nuprc','product_crude','regulates',1),
('inst_nuprc','fuel_gas','regulates',1),
('inst_nuprc','term_bonny','regulates',1),
('inst_nuprc','term_forcados','regulates',1),
('inst_nuprc','term_quaiboe','regulates',1),
('inst_nuprc','term_escravos','regulates',1),
('inst_nuprc','term_brass','regulates',1),
('inst_nuprc','term_bonga','regulates',1),
('inst_nuprc','term_agbami','regulates',1),
('inst_nmdpra','ref_dangote','regulates',1),
('inst_nmdpra','ref_ph','regulates',1),
('inst_nmdpra','ref_warri','regulates',1),
('inst_nmdpra','ref_kaduna','regulates',1),
('inst_nmdpra','mid_nlng','regulates',1),
('inst_nmdpra','prod_pms','regulates',1),
('inst_nmdpra','prod_ago','regulates',1),
('inst_nmdpra','prod_dpk','regulates',1),
('inst_nmdpra','prod_lpg','regulates',1),
('inst_nerc','tcn','regulates',1),
('inst_nerc','disco_abuja','regulates',1),
('inst_nerc','disco_benin','regulates',1),
('inst_nerc','disco_eko','regulates',1),
('inst_nerc','disco_enugu','regulates',1),
('inst_nerc','disco_ibadan','regulates',1),
('inst_nerc','disco_ikeja','regulates',1),
('inst_nerc','disco_jos','regulates',1),
('inst_nerc','disco_kaduna','regulates',1),
('inst_nerc','disco_kano','regulates',1),
('inst_nerc','disco_ph','regulates',1),
('inst_nerc','disco_yola','regulates',1),
-- Operation & policy lineage
('inst_nnpc','ref_ph','operates',1),
('inst_nnpc','ref_warri','operates',1),
('inst_nnpc','ref_kaduna','operates',1),
('policy_pia','inst_nuprc','governs',1),
('policy_pia','inst_nmdpra','governs',1),
('policy_pia','inst_nnpc','governs',1),
('inst_ecn','policy_necal','governs',1),
('inst_ecn','policy_renewable','governs',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;
