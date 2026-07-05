-- ── 020: State-level data — lights up the Nigeria choropleths ────────────────
-- Two verified state-disaggregated datasets:
--  A) PMS truck-out by state, June 2025 — NMDPRA monthly distribution data
--     (South-East states published only as a 132.7M-litre aggregate → omitted).
--  B) Crude oil production by state — NUPRC cumulative volumes, Nov 2023–Sep 2024
--     (top four producing states; smaller producers not individually published).
-- Region values use state display names, matching the NigeriaMap component keys.

-- A) PMS by state — June 2025, million litres → litres
INSERT INTO energy_records
  (series_type_id, period, period_date, region, fuel_product, value, unit, source, notes, methodology_version)
VALUES
('pms_sales','2025-06','2025-06-01','Lagos','PMS',205700000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Ogun','PMS',88700000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','FCT (Abuja)','PMS',77500000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Oyo','PMS',72800000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Delta','PMS',68500000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Kano','PMS',68220000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Rivers','PMS',44600000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Kaduna','PMS',43130000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Edo','PMS',43100000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Niger','PMS',40700000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Sokoto','PMS',37040000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Osun','PMS',35480000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Ondo','PMS',35050000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Kwara','PMS',34800000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Akwa Ibom','PMS',33800000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Kebbi','PMS',30310000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Benue','PMS',25700000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Nasarawa','PMS',25100000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Katsina','PMS',24800000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Kogi','PMS',24100000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Cross River','PMS',23000000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Plateau','PMS',19400000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Zamfara','PMS',17040000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Ekiti','PMS',15260000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Bayelsa','PMS',11900000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),
('pms_sales','2025-06','2025-06-01','Jigawa','PMS',9400000,'Litres','NMDPRA monthly distribution data','State truck-out, June 2025','v1'),

-- B) Crude by state — NUPRC cumulative Nov 2023–Sep 2024 (top 4 = ~85% of output)
('crude_oil_production','2024','2024-09-30','Delta','Crude',99900000,'Barrels','NUPRC (state production, Nov 2023–Sep 2024)','Cumulative 11-month volume','v1'),
('crude_oil_production','2024','2024-09-30','Akwa Ibom','Crude',60320000,'Barrels','NUPRC (state production, Nov 2023–Sep 2024)','Cumulative 11-month volume','v1'),
('crude_oil_production','2024','2024-09-30','Bayelsa','Crude',53280000,'Barrels','NUPRC (state production, Nov 2023–Sep 2024)','Cumulative 11-month volume','v1'),
('crude_oil_production','2024','2024-09-30','Rivers','Crude',50840000,'Barrels','NUPRC (state production, Nov 2023–Sep 2024)','Cumulative 11-month volume','v1');

-- Enable the Nigeria map tab on crude (it now has state-level rows)
UPDATE series_types
SET viz_types = array_append(viz_types, 'choropleth')
WHERE id = 'crude_oil_production' AND NOT ('choropleth' = ANY(viz_types));
