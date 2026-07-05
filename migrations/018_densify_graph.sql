-- ── 018: Densify the Energy Knowledge Graph ──────────────────────────────────
-- Adds: 13 real generation plants (NIPP/IPP/hydro/wind, publicly documented
-- capacities), wind as a primary-energy node, the remaining 27 states, and the
-- REAL DisCo franchise coverage map (every state served by its actual DisCo).
-- Result: ~84 nodes / ~105 edges — every state in the federation reachable.

-- ── New fuel node ─────────────────────────────────────────────────────────────
INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
('fuel_wind','Wind','fuel','{"renewable":true}')
ON CONFLICT (node_key) DO NOTHING;

-- ── New generation plants (documented capacities) ────────────────────────────
INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
('genco_geregu','Geregu I Power','genco','{"capacity_mw":435,"state":"Kogi","fuel":"gas","description":"Gas-fired plant at Ajaokuta, Kogi. Listed on NGX as Geregu Power Plc — Nigeria''s first listed GenCo."}'),
('genco_geregu_nipp','Geregu II (NIPP)','genco','{"capacity_mw":434,"state":"Kogi","fuel":"gas","description":"National Integrated Power Project plant adjacent to Geregu I."}'),
('genco_ihovbor','Ihovbor (NIPP)','genco','{"capacity_mw":450,"state":"Edo","fuel":"gas","description":"NIPP gas plant near Benin City, Edo State."}'),
('genco_sapele_nipp','Sapele (NIPP)','genco','{"capacity_mw":450,"state":"Delta","fuel":"gas","description":"NIPP gas plant beside the legacy Sapele steam station."}'),
('genco_odukpani','Odukpani / Calabar (NIPP)','genco','{"capacity_mw":562,"state":"Cross River","fuel":"gas","description":"Largest NIPP plant; supplies the south-south axis via Ikot Ekpene switching station."}'),
('genco_alaoji','Alaoji (NIPP)','genco','{"capacity_mw":504,"state":"Abia","fuel":"gas","description":"NIPP combined-cycle plant near Aba, Abia State."}'),
('genco_gbarain','Gbarain (NIPP)','genco','{"capacity_mw":225,"state":"Bayelsa","fuel":"gas","description":"NIPP gas plant in Yenagoa LGA, Bayelsa."}'),
('genco_omoku','Omoku','genco','{"capacity_mw":150,"state":"Rivers","fuel":"gas","description":"Rivers State-built gas plant at Omoku."}'),
('genco_rivers_ipp','Rivers IPP (Trans-Amadi)','genco','{"capacity_mw":180,"state":"Rivers","fuel":"gas","description":"Independent power plant serving Port Harcourt industrial axis."}'),
('genco_ibom','Ibom Power','genco','{"capacity_mw":190,"state":"Akwa Ibom","fuel":"gas","description":"Akwa Ibom State-owned gas plant at Ikot Abasi."}'),
('genco_dadinkowa','Dadin Kowa Hydro','genco','{"capacity_mw":40,"state":"Gombe","fuel":"hydro","description":"Hydro plant on the Gongola River, commissioned 2020 — the North-East''s main grid injection."}'),
('genco_kashimbilla','Kashimbilla Hydro','genco','{"capacity_mw":40,"state":"Taraba","fuel":"hydro","description":"Multipurpose dam hydro plant in Taraba, commissioned 2020."}'),
('genco_katsina_wind','Katsina Wind Farm','genco','{"capacity_mw":10,"state":"Katsina","fuel":"wind","description":"Nigeria''s first utility wind farm, at Lambar Rimi, Katsina."}')
ON CONFLICT (node_key) DO NOTHING;

-- ── Remaining states (completes all 36 + FCT) ─────────────────────────────────
INSERT INTO graph_nodes (node_key, label, node_type, meta) VALUES
('state_abia','Abia','state','{}'),('state_akwaibom','Akwa Ibom','state','{}'),
('state_anambra','Anambra','state','{}'),('state_bauchi','Bauchi','state','{}'),
('state_bayelsa','Bayelsa','state','{}'),('state_benue','Benue','state','{}'),
('state_borno','Borno','state','{}'),('state_crossriver','Cross River','state','{}'),
('state_delta','Delta','state','{}'),('state_ebonyi','Ebonyi','state','{}'),
('state_ekiti','Ekiti','state','{}'),('state_gombe','Gombe','state','{}'),
('state_imo','Imo','state','{}'),('state_jigawa','Jigawa','state','{}'),
('state_katsina','Katsina','state','{}'),('state_kebbi','Kebbi','state','{}'),
('state_kogi','Kogi','state','{}'),('state_kwara','Kwara','state','{}'),
('state_nasarawa','Nasarawa','state','{}'),('state_niger','Niger','state','{}'),
('state_ogun','Ogun','state','{}'),('state_ondo','Ondo','state','{}'),
('state_osun','Osun','state','{}'),('state_sokoto','Sokoto','state','{}'),
('state_taraba','Taraba','state','{}'),('state_yobe','Yobe','state','{}'),
('state_zamfara','Zamfara','state','{}')
ON CONFLICT (node_key) DO NOTHING;

-- ── Fuel → plant edges ────────────────────────────────────────────────────────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('fuel_gas','genco_geregu','fuel_supply',435),
('fuel_gas','genco_geregu_nipp','fuel_supply',434),
('fuel_gas','genco_ihovbor','fuel_supply',450),
('fuel_gas','genco_sapele_nipp','fuel_supply',450),
('fuel_gas','genco_odukpani','fuel_supply',562),
('fuel_gas','genco_alaoji','fuel_supply',504),
('fuel_gas','genco_gbarain','fuel_supply',225),
('fuel_gas','genco_omoku','fuel_supply',150),
('fuel_gas','genco_rivers_ipp','fuel_supply',180),
('fuel_gas','genco_ibom','fuel_supply',190),
('fuel_hydro','genco_dadinkowa','fuel_supply',40),
('fuel_hydro','genco_kashimbilla','fuel_supply',40),
('fuel_wind','genco_katsina_wind','fuel_supply',10)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── Plant → TCN edges ─────────────────────────────────────────────────────────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
('genco_geregu','tcn','generates',435),
('genco_geregu_nipp','tcn','generates',434),
('genco_ihovbor','tcn','generates',450),
('genco_sapele_nipp','tcn','generates',450),
('genco_odukpani','tcn','generates',562),
('genco_alaoji','tcn','generates',504),
('genco_gbarain','tcn','generates',225),
('genco_omoku','tcn','generates',150),
('genco_rivers_ipp','tcn','generates',180),
('genco_ibom','tcn','generates',190),
('genco_dadinkowa','tcn','generates',40),
('genco_kashimbilla','tcn','generates',40),
('genco_katsina_wind','tcn','generates',10)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── Real DisCo franchise coverage (completes every state) ─────────────────────
INSERT INTO graph_edges (source_key, target_key, edge_type, weight) VALUES
-- Abuja DisCo: FCT, Niger, Kogi, Nasarawa
('disco_abuja','state_niger','distributes',1),
('disco_abuja','state_kogi','distributes',1),
('disco_abuja','state_nasarawa','distributes',1),
-- Benin DisCo: Edo, Delta, Ondo, Ekiti
('disco_benin','state_delta','distributes',1),
('disco_benin','state_ondo','distributes',1),
('disco_benin','state_ekiti','distributes',1),
-- Enugu DisCo: all five South-East states
('disco_enugu','state_abia','distributes',1),
('disco_enugu','state_anambra','distributes',1),
('disco_enugu','state_ebonyi','distributes',1),
('disco_enugu','state_imo','distributes',1),
-- Ibadan DisCo: Oyo, Ogun, Osun, Kwara
('disco_ibadan','state_ogun','distributes',1),
('disco_ibadan','state_osun','distributes',1),
('disco_ibadan','state_kwara','distributes',1),
-- Jos DisCo: Plateau, Bauchi, Benue, Gombe
('disco_jos','state_bauchi','distributes',1),
('disco_jos','state_benue','distributes',1),
('disco_jos','state_gombe','distributes',1),
-- Kaduna DisCo: Kaduna, Kebbi, Sokoto, Zamfara
('disco_kaduna','state_kebbi','distributes',1),
('disco_kaduna','state_sokoto','distributes',1),
('disco_kaduna','state_zamfara','distributes',1),
-- Kano DisCo: Kano, Jigawa, Katsina
('disco_kano','state_jigawa','distributes',1),
('disco_kano','state_katsina','distributes',1),
-- Port Harcourt DisCo: Rivers, Bayelsa, Cross River, Akwa Ibom
('disco_ph','state_bayelsa','distributes',1),
('disco_ph','state_crossriver','distributes',1),
('disco_ph','state_akwaibom','distributes',1),
-- Yola DisCo: Adamawa, Borno, Taraba, Yobe
('disco_yola','state_borno','distributes',1),
('disco_yola','state_taraba','distributes',1),
('disco_yola','state_yobe','distributes',1)
ON CONFLICT (source_key, target_key, edge_type) DO NOTHING;

-- ── DisCo dossiers (franchise coverage shown on click) ────────────────────────
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: FCT, Niger, Kogi, Nasarawa."}'::jsonb WHERE node_key='disco_abuja';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Edo, Delta, Ondo, Ekiti."}'::jsonb WHERE node_key='disco_benin';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Lagos Island and coastal Lagos."}'::jsonb WHERE node_key='disco_eko';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Enugu, Abia, Anambra, Ebonyi, Imo — the entire South-East."}'::jsonb WHERE node_key='disco_enugu';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Oyo, Ogun, Osun, Kwara — Nigeria''s largest DisCo by coverage area."}'::jsonb WHERE node_key='disco_ibadan';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Lagos mainland north — Nigeria''s largest DisCo by customer count."}'::jsonb WHERE node_key='disco_ikeja';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Plateau, Bauchi, Benue, Gombe."}'::jsonb WHERE node_key='disco_jos';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Kaduna, Kebbi, Sokoto, Zamfara."}'::jsonb WHERE node_key='disco_kaduna';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Kano, Jigawa, Katsina."}'::jsonb WHERE node_key='disco_kano';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Rivers, Bayelsa, Cross River, Akwa Ibom."}'::jsonb WHERE node_key='disco_ph';
UPDATE graph_nodes SET meta = meta || '{"description":"Franchise: Adamawa, Borno, Taraba, Yobe."}'::jsonb WHERE node_key='disco_yola';
