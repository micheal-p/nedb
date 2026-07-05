-- ── 022: Fuelwood — switch unit to m³ and seed the real FAO series ───────────
-- The tonnes unit was NEDB's own seed choice; FAO (whose WISDOM methodology the
-- series already cites) publishes woodfuel in solid cubic metres. Changing the
-- unit to match the authoritative source beats inventing a conversion factor.

UPDATE series_types SET
  unit_default = 'm³',
  what_is = 'Estimated volume of woodfuel (firewood and wood converted to charcoal) produced and consumed in Nigeria each year, in solid cubic metres, following the FAO methodology.',
  how_to_read = 'Values are in solid cubic metres of wood. Nigeria is Africa''s third-largest woodfuel producer. A flat or rising line means dependence on traditional biomass is not declining.',
  signal_rules = jsonb_set(signal_rules, '{unit_label}', '"m³"')
WHERE id = 'fuelwood_consumption';

INSERT INTO energy_records
  (series_type_id, period, period_date, region, fuel_product, value, unit, source, notes, methodology_version)
VALUES
('fuelwood_consumption','2005','2005-01-01','NGA',NULL,61274260,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2006','2006-01-01','NGA',NULL,61629309,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2007','2007-01-01','NGA',NULL,62000000,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2008','2008-01-01','NGA',NULL,62388600,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2009','2009-01-01','NGA',NULL,62793234,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2010','2010-01-01','NGA',NULL,63214728,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2011','2011-01-01','NGA',NULL,63599551,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2012','2012-01-01','NGA',NULL,63999115,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2013','2013-01-01','NGA',NULL,64413551,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2014','2014-01-01','NGA',NULL,64843002,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2015','2015-01-01','NGA',NULL,65287615,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2016','2016-01-01','NGA',NULL,65583432,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2017','2017-01-01','NGA',NULL,65890862,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2018','2018-01-01','NGA',NULL,66209938,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2019','2019-01-01','NGA',NULL,66540702,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2020','2020-01-01','NGA',NULL,66883195,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2021','2021-01-01','NGA',NULL,67239649,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1'),
('fuelwood_consumption','2022','2022-01-01','NGA',NULL,67239649,'m³','FAOSTAT (FAO Forestry Statistics, via UN Data)','Annual woodfuel production/consumption, solid volume','v1');
