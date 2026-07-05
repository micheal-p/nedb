-- ── 021: Fill remaining series with verified data ─────────────────────────────
-- Fills 4 of the 6 empty series. Deliberately still empty (accuracy-or-skip):
--   electricity_sent_out  — no clean annual national totals published; deriving
--                           from generation would be fabrication.
--   fuelwood_consumption  — only FAO m³ estimates exist; unit is tonnes and the
--                           conversion factor would dominate the number.

INSERT INTO energy_records
  (series_type_id, period, period_date, region, fuel_product, value, unit, source, notes, methodology_version)
VALUES
-- A) AGO (diesel) — NBS total available supply (imports + local refining)
('ago_sales','2022','2022-01-01','NGA','AGO',4100000000,'Litres','NBS Petroleum Products Statistics','Total available diesel: 4.00bn L imported + 102.5M L locally refined','v1'),
('ago_sales','2023','2023-01-01','NGA','AGO',5050000000,'Litres','NBS Petroleum Products Statistics','Total available diesel: 4.94bn L imported + 109.4M L locally refined','v1'),

-- B) Coal production — EIA/NBS-derived, short tons converted to metric tonnes
('coal_production','2021','2021-01-01','NGA',NULL,1444000,'Tonnes','US EIA / NBS mineral statistics','Derived from 2022 volume and the reported +110.7% YoY growth','v1'),
('coal_production','2022','2022-01-01','NGA',NULL,3043000,'Tonnes','US EIA / NBS mineral statistics','3,354.33 thousand short tons converted to metric tonnes','v1'),
('coal_production','2023','2023-01-01','NGA',NULL,1322000,'Tonnes','US EIA','1,457.31 thousand short tons converted to metric tonnes','v1'),

-- C) Electricity consumption — energy distributed by DisCos
('electricity_consumption','2023','2023-01-01','NGA',NULL,24000,'GWh','NERC (via Statista)','Approx. energy distributed to end users by the 11 DisCos in 2023','v1'),

-- D) Renewable capacity — grid plant nameplates + IRENA solar PV + Katsina wind
-- Hydro: Kainji 760 + Jebba 578 + Shiroro 600 = 1,938 MW; +Dadin Kowa 40 &
-- Kashimbilla 40 (2020) = 2,018; +Zungeru 700 (2023) = 2,718.
-- Solar PV: IRENA annual installed capacity. Wind: Katsina 10 MW from 2021.
('renewable_capacity','2013','2013-01-01','NGA',NULL,1941,'MW','IRENA (solar) + plant nameplates (hydro)','1,938 hydro + 3 solar','v1'),
('renewable_capacity','2014','2014-01-01','NGA',NULL,1942,'MW','IRENA (solar) + plant nameplates (hydro)','1,938 hydro + 4 solar','v1'),
('renewable_capacity','2015','2015-01-01','NGA',NULL,1954,'MW','IRENA (solar) + plant nameplates (hydro)','1,938 hydro + 16 solar','v1'),
('renewable_capacity','2016','2016-01-01','NGA',NULL,1960,'MW','IRENA (solar) + plant nameplates (hydro)','1,938 hydro + 22 solar','v1'),
('renewable_capacity','2017','2017-01-01','NGA',NULL,1966,'MW','IRENA (solar) + plant nameplates (hydro)','1,938 hydro + 28 solar','v1'),
('renewable_capacity','2018','2018-01-01','NGA',NULL,1970,'MW','IRENA (solar) + plant nameplates (hydro)','1,938 hydro + 32 solar','v1'),
('renewable_capacity','2019','2019-01-01','NGA',NULL,1990,'MW','IRENA (solar) + plant nameplates (hydro)','1,938 hydro + 52 solar','v1'),
('renewable_capacity','2020','2020-01-01','NGA',NULL,2096,'MW','IRENA (solar) + plant nameplates (hydro)','2,018 hydro (+Dadin Kowa, Kashimbilla) + 78 solar','v1'),
('renewable_capacity','2021','2021-01-01','NGA',NULL,2139,'MW','IRENA (solar) + plant nameplates (hydro/wind)','2,018 hydro + 111 solar + 10 wind (Katsina)','v1'),
('renewable_capacity','2022','2022-01-01','NGA',NULL,2168,'MW','IRENA (solar) + plant nameplates (hydro/wind)','2,018 hydro + 140 solar + 10 wind','v1'),
('renewable_capacity','2023','2023-01-01','NGA',NULL,2909,'MW','IRENA (solar) + plant nameplates (hydro/wind)','2,718 hydro (+Zungeru 700) + 181 solar + 10 wind','v1'),
('renewable_capacity','2024','2024-01-01','NGA',NULL,2925,'MW','IRENA (solar) + plant nameplates (hydro/wind)','2,718 hydro + 197 solar + 10 wind','v1');
