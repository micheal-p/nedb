INSERT INTO series_types (id, name, sector, subsector, unit_default, frequency, viz_types) VALUES
  ('crude_oil_production',      'Crude Oil Production',         'petroleum',    'upstream',    'Barrels',       'monthly',   ARRAY['line','stacked-area','horizontal-bar']),
  ('pms_sales',                 'PMS (Petrol) Sales',           'petroleum',    'downstream',  'Litres',        'monthly',   ARRAY['line','horizontal-bar','heatmap']),
  ('lpg_sales',                 'LPG Sales',                    'petroleum',    'downstream',  'Metric Tonnes', 'monthly',   ARRAY['line','horizontal-bar']),
  ('ago_sales',                 'AGO (Diesel) Sales',           'petroleum',    'downstream',  'Litres',        'monthly',   ARRAY['line','horizontal-bar','heatmap']),
  ('natural_gas_production',    'Natural Gas Production',       'petroleum',    'upstream',    'MMSCFD',        'monthly',   ARRAY['line','sankey','stacked-area']),
  ('electricity_generation',    'Electricity Generation',       'electricity',  'generation',  'GWh',           'quarterly', ARRAY['line','stacked-area','small-multiples']),
  ('electricity_consumption',   'Electricity Consumption',      'electricity',  'consumption', 'GWh',           'annual',    ARRAY['line','heatmap','choropleth']),
  ('electricity_sent_out',      'Electricity Sent Out',         'electricity',  'grid',        'GWh',           'quarterly', ARRAY['line','calendar-heatmap']),
  ('fuelwood_consumption',      'Fuelwood Consumption',         'biomass',      NULL,          'Metric Tonnes', 'annual',    ARRAY['choropleth','horizontal-bar']),
  ('charcoal_consumption',      'Charcoal Consumption',         'biomass',      NULL,          'Metric Tonnes', 'annual',    ARRAY['line','horizontal-bar']),
  ('coal_consumption',          'Coal Consumption',             'biomass',      NULL,          'Metric Tonnes', 'annual',    ARRAY['line','horizontal-bar']),
  ('coal_export',               'Coal Export',                  'biomass',      NULL,          'Metric Tonnes', 'annual',    ARRAY['line','horizontal-bar'])
ON CONFLICT (id) DO NOTHING;
