-- ── 017: Seed verified historical data (demo) ────────────────────────────────
-- Real published figures only; every row carries its source. Series where
-- accurate public figures could not be verified were deliberately left empty:
-- ago_sales, electricity_sent_out, electricity_consumption, fuelwood_consumption,
-- coal_production, renewable_capacity.
-- Compiled 2026-07-04 from NUPRC, NBS/NMDPRA, PPPRA,
-- Energy Institute Statistical Review and Ember (via Our World in Data), NERC/EIA.

INSERT INTO energy_records
  (series_type_id, period, period_date, region, fuel_product, value, unit, source, notes, methodology_version)
VALUES
('crude_oil_production', '2023-01', '2023-01-01', 'NGA', 'Crude', 38998000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.258 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2023-02', '2023-02-01', 'NGA', 'Crude', 36568000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.306 mbpd avg x 28 days', 'v1'),
('crude_oil_production', '2023-03', '2023-03-01', 'NGA', 'Crude', 39308000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.268 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2023-04', '2023-04-01', 'NGA', 'Crude', 29970000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 0.999 mbpd avg x 30 days', 'v1'),
('crude_oil_production', '2023-05', '2023-05-01', 'NGA', 'Crude', 36704000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.184 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2023-06', '2023-06-01', 'NGA', 'Crude', 37470000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.249 mbpd avg x 30 days', 'v1'),
('crude_oil_production', '2023-07', '2023-07-01', 'NGA', 'Crude', 33511000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.081 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2023-08', '2023-08-01', 'NGA', 'Crude', 36611000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.181 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2023-09', '2023-09-01', 'NGA', 'Crude', 40410000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.347 mbpd avg x 30 days', 'v1'),
('crude_oil_production', '2023-10', '2023-10-01', 'NGA', 'Crude', 41881000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.351 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2023-11', '2023-11-01', 'NGA', 'Crude', 37380000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.246 mbpd avg x 30 days', 'v1'),
('crude_oil_production', '2023-12', '2023-12-01', 'NGA', 'Crude', 41385000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.335 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2024-01', '2024-01-01', 'NGA', 'Crude', 44237000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.427 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2024-02', '2024-02-01', 'NGA', 'Crude', 38338000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.322 mbpd avg x 29 days', 'v1'),
('crude_oil_production', '2024-03', '2024-03-01', 'NGA', 'Crude', 38161000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.231 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2024-04', '2024-04-01', 'NGA', 'Crude', 38430000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.281 mbpd avg x 30 days', 'v1'),
('crude_oil_production', '2024-05', '2024-05-01', 'NGA', 'Crude', 38750000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.250 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2024-06', '2024-06-01', 'NGA', 'Crude', 38280000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.276 mbpd avg x 30 days', 'v1'),
('crude_oil_production', '2024-07', '2024-07-01', 'NGA', 'Crude', 40517000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.307 mbpd avg x 31 days', 'v1'),
('crude_oil_production', '2024-08', '2024-08-01', 'NGA', 'Crude', 41912000, 'Barrels', 'NUPRC monthly production reports', 'Crude only (excl. condensate); 1.352 mbpd avg x 31 days', 'v1'),
('natural_gas_production', '2005', '2005-01-01', 'NGA', 'NG', 2224, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~23.0 bcm for the year', 'v1'),
('natural_gas_production', '2006', '2006-01-01', 'NGA', 'NG', 2602, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~26.9 bcm for the year', 'v1'),
('natural_gas_production', '2007', '2007-01-01', 'NGA', 'NG', 3254, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~33.6 bcm for the year', 'v1'),
('natural_gas_production', '2008', '2008-01-01', 'NGA', 'NG', 3171, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~32.8 bcm for the year', 'v1'),
('natural_gas_production', '2009', '2009-01-01', 'NGA', 'NG', 2244, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~23.2 bcm for the year', 'v1'),
('natural_gas_production', '2010', '2010-01-01', 'NGA', 'NG', 2990, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~30.9 bcm for the year', 'v1'),
('natural_gas_production', '2011', '2011-01-01', 'NGA', 'NG', 3524, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~36.4 bcm for the year', 'v1'),
('natural_gas_production', '2012', '2012-01-01', 'NGA', 'NG', 3789, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~39.2 bcm for the year', 'v1'),
('natural_gas_production', '2013', '2013-01-01', 'NGA', 'NG', 3202, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~33.1 bcm for the year', 'v1'),
('natural_gas_production', '2014', '2014-01-01', 'NGA', 'NG', 3868, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~40.0 bcm for the year', 'v1'),
('natural_gas_production', '2015', '2015-01-01', 'NGA', 'NG', 4602, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~47.6 bcm for the year', 'v1'),
('natural_gas_production', '2016', '2016-01-01', 'NGA', 'NG', 4125, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~42.6 bcm for the year', 'v1'),
('natural_gas_production', '2017', '2017-01-01', 'NGA', 'NG', 4567, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~47.2 bcm for the year', 'v1'),
('natural_gas_production', '2018', '2018-01-01', 'NGA', 'NG', 4670, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~48.3 bcm for the year', 'v1'),
('natural_gas_production', '2019', '2019-01-01', 'NGA', 'NG', 4768, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~49.3 bcm for the year', 'v1'),
('natural_gas_production', '2020', '2020-01-01', 'NGA', 'NG', 4782, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~49.4 bcm for the year', 'v1'),
('natural_gas_production', '2021', '2021-01-01', 'NGA', 'NG', 5074, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~52.4 bcm for the year', 'v1'),
('natural_gas_production', '2022', '2022-01-01', 'NGA', 'NG', 4559, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~47.1 bcm for the year', 'v1'),
('natural_gas_production', '2023', '2023-01-01', 'NGA', 'NG', 4291, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~44.4 bcm for the year', 'v1'),
('natural_gas_production', '2024', '2024-01-01', 'NGA', 'NG', 4532, 'MMSCFD', 'Energy Institute Statistical Review (via Our World in Data)', 'Marketed dry production; annual avg rate; ~46.8 bcm for the year', 'v1'),
('electricity_generation', '2005', '2005-01-01', 'NGA', NULL, 23550, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2006', '2006-01-01', 'NGA', NULL, 23120, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2007', '2007-01-01', 'NGA', NULL, 22990, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2008', '2008-01-01', 'NGA', NULL, 21120, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2009', '2009-01-01', 'NGA', NULL, 19790, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2010', '2010-01-01', 'NGA', NULL, 26130, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2011', '2011-01-01', 'NGA', NULL, 27040, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2012', '2012-01-01', 'NGA', NULL, 28740, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2013', '2013-01-01', 'NGA', NULL, 28930, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2014', '2014-01-01', 'NGA', NULL, 32280, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2015', '2015-01-01', 'NGA', NULL, 33170, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2016', '2016-01-01', 'NGA', NULL, 36540, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2017', '2017-01-01', 'NGA', NULL, 32240, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2018', '2018-01-01', 'NGA', NULL, 36710, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2019', '2019-01-01', 'NGA', NULL, 36460, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2020', '2020-01-01', 'NGA', NULL, 38000, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2021', '2021-01-01', 'NGA', NULL, 39200, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2022', '2022-01-01', 'NGA', NULL, 38000, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2023', '2023-01-01', 'NGA', NULL, 40920, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('electricity_generation', '2024', '2024-01-01', 'NGA', NULL, 37560, 'GWh', 'Ember Yearly Electricity Data (via Our World in Data)', 'Annual total generation', 'v1'),
('pms_sales', '2019', '2019-01-01', 'NGA', 'PMS', 20890000000, 'Litres', 'NBS Petroleum Products Distribution Statistics / NMDPRA', 'Annual national truck-out volume (20.89 billion litres). 2020 omitted — subsidy-era figures disputed', 'v1'),
('pms_sales', '2021', '2021-01-01', 'NGA', 'PMS', 22350000000, 'Litres', 'NBS Petroleum Products Distribution Statistics / NMDPRA', 'Annual national truck-out volume (22.35 billion litres). 2020 omitted — subsidy-era figures disputed', 'v1'),
('pms_sales', '2022', '2022-01-01', 'NGA', 'PMS', 24350000000, 'Litres', 'NBS Petroleum Products Distribution Statistics / NMDPRA', 'Annual national truck-out volume (24.35 billion litres). 2020 omitted — subsidy-era figures disputed', 'v1'),
('pms_sales', '2023', '2023-01-01', 'NGA', 'PMS', 20220000000, 'Litres', 'NBS Petroleum Products Distribution Statistics / NMDPRA', 'Annual national truck-out volume (20.22 billion litres). 2020 omitted — subsidy-era figures disputed', 'v1'),
('lpg_sales', '2018', '2018-01-01', 'NGA', 'LPG', 635452, 'Metric Tonnes', 'PPPRA / NBS', 'Annual national LPG consumption', 'v1'),
('lpg_sales', '2019', '2019-01-01', 'NGA', 'LPG', 840594, 'Metric Tonnes', 'PPPRA / NBS', 'Annual national LPG consumption', 'v1'),
('lpg_sales', '2020', '2020-01-01', 'NGA', 'LPG', 1043061, 'Metric Tonnes', 'PPPRA / NBS', 'Annual national LPG consumption', 'v1'),
('installed_capacity', '2014', '2014-01-01', 'NGA', NULL, 10600, 'MW', 'NERC / US EIA', 'Total grid-connected installed generation capacity', 'v1'),
('installed_capacity', '2015', '2015-01-01', 'NGA', NULL, 12522, 'MW', 'NERC / US EIA', 'Total grid-connected installed generation capacity', 'v1'),
('installed_capacity', '2020', '2020-01-01', 'NGA', NULL, 13014, 'MW', 'NERC / US EIA', 'Total grid-connected installed generation capacity', 'v1'),
('installed_capacity', '2023', '2023-01-01', 'NGA', NULL, 14100, 'MW', 'NERC / US EIA', 'Total grid-connected installed generation capacity', 'v1');

-- ── Knowledge Graph: node dossiers (shown in the sidebar on click) ────────────
UPDATE graph_nodes SET meta = meta || '{"description":"Nigeria Energy Calculator 2050 — ECN''s national scenario model for charting energy demand and supply pathways to net-zero by 2060. Lets planners test how policy choices ripple across the whole energy system to 2050.","operator":"Energy Commission of Nigeria","year":"2015"}'::jsonb WHERE node_key = 'policy_necal';
UPDATE graph_nodes SET meta = meta || '{"description":"Petroleum Industry Act 2021 — the fiscal and regulatory framework for the petroleum sector. Established NUPRC (upstream) and NMDPRA (midstream/downstream) as successor regulators.","operator":"Federal Government of Nigeria","year":"2021"}'::jsonb WHERE node_key = 'policy_pia';
UPDATE graph_nodes SET meta = meta || '{"description":"National LPG Expansion Programme — federal drive to deepen domestic cooking-gas adoption and displace firewood and kerosene in households.","operator":"Office of the Vice President / NNPC","year":"2017"}'::jsonb WHERE node_key = 'policy_lpg';
UPDATE graph_nodes SET meta = meta || '{"description":"National Renewable Energy and Energy Efficiency Policy — targets for solar, hydro, wind and biomass capacity in the national energy mix.","operator":"Federal Ministry of Power","year":"2015"}'::jsonb WHERE node_key = 'policy_renewable';
UPDATE graph_nodes SET meta = meta || '{"description":"Sole operator of the national high-voltage transmission grid. Every grid-connected megawatt in Nigeria must pass through TCN to reach a distribution company — making it the single most critical node in the network.","operator":"Federal Government of Nigeria (100%)"}'::jsonb WHERE node_key = 'tcn';
UPDATE graph_nodes SET meta = meta || '{"description":"Nigeria''s largest thermal power station, gas-fired, on the Lagos lagoon. Commissioned 1985."}'::jsonb WHERE node_key = 'genco_egbin';
UPDATE graph_nodes SET meta = meta || '{"description":"Nigeria''s first hydroelectric dam (1968), on the River Niger."}'::jsonb WHERE node_key = 'genco_kainji';
UPDATE graph_nodes SET meta = meta || '{"description":"700 MW hydro plant commissioned 2023 — the largest power project completed in Nigeria in three decades."}'::jsonb WHERE node_key = 'genco_zungeru';
