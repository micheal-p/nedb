-- ── 013: Series explanation metadata + signal rules + geo resolution ──────────
-- Adds structured explanation fields to every series_type so the public
-- portal and Data Point can render "What this is / How to read / Why it matters
-- / Current signal" without any AI call at runtime.

ALTER TABLE series_types
  ADD COLUMN IF NOT EXISTS what_is       TEXT,
  ADD COLUMN IF NOT EXISTS how_to_read   TEXT,
  ADD COLUMN IF NOT EXISTS why_it_matters TEXT,
  ADD COLUMN IF NOT EXISTS signal_rules  JSONB,
  ADD COLUMN IF NOT EXISTS geo_resolution TEXT NOT NULL DEFAULT 'national'
    CHECK (geo_resolution IN ('national','state','lga'));

-- signal_rules JSONB shape:
-- {
--   "compare_to": "5yr_avg" | "prev_period" | "target",
--   "target_value": 1800000,          -- optional fixed target
--   "unit_label": "bbl/day",
--   "threshold_warn": -10,            -- % below reference = amber
--   "threshold_critical": -25,        -- % below reference = red
--   "direction": "higher_is_better" | "lower_is_better",
--   "templates": {
--     "above":    "Production is {pct}% above the 5-year average.",
--     "neutral":  "Production is in line with the 5-year average.",
--     "warn":     "Production is {pct}% below the 5-year average, suggesting underperformance.",
--     "critical": "Production is {pct}% below the 5-year average. This is a critical shortfall."
--   }
-- }

-- ── Seed existing series ───────────────────────────────────────────────────────

UPDATE series_types SET
  what_is        = 'The total volume of crude oil lifted from Nigerian upstream oil fields and offshore terminals each month, measured in barrels.',
  how_to_read    = 'Higher values mean more oil is being produced. Values are in barrels per month. Nigeria''s OPEC quota is typically expressed in barrels per day — divide monthly figures by the number of days in the period to compare.',
  why_it_matters = 'Crude oil production is the single largest source of Nigeria''s foreign exchange earnings and the primary driver of FAAC allocations to all tiers of government. A sustained decline directly reduces government revenue and the naira''s reserve backing.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"barrels","threshold_warn":-10,"threshold_critical":-25,"direction":"higher_is_better","templates":{"above":"Production is {pct}% above the 5-year average, indicating strong upstream output.","neutral":"Production is broadly in line with the 5-year average.","warn":"Production is {pct}% below the 5-year average, suggesting field disruptions or quota compliance cuts.","critical":"Production is {pct}% below the 5-year average. This is a critical shortfall with significant revenue implications."}}',
  geo_resolution = 'national'
WHERE id = 'crude_oil_production';

UPDATE series_types SET
  what_is        = 'Total natural gas produced in Nigeria each month, covering both associated gas (produced alongside crude oil) and non-associated gas, including volumes flared, re-injected, and utilised.',
  how_to_read    = 'Values are in million standard cubic feet (MMscf) per month. Utilised gas is the portion that generates revenue or powers domestic industry. Flared gas represents waste and environmental liability.',
  why_it_matters = 'Gas is Nigeria''s largest energy resource by volume. Monetising gas — rather than flaring it — is central to the government''s diversification strategy and the foundation of the domestic electricity supply chain.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"MMscf","threshold_warn":-8,"threshold_critical":-20,"direction":"higher_is_better","templates":{"above":"Gas production is {pct}% above the 5-year average.","neutral":"Gas production is in line with the 5-year average.","warn":"Gas production is {pct}% below the 5-year average.","critical":"Gas production is {pct}% below the 5-year average — a significant supply constraint."}}',
  geo_resolution = 'national'
WHERE id = 'natural_gas_production';

UPDATE series_types SET
  what_is        = 'The total volume of Premium Motor Spirit (petrol) sold through licensed filling stations and bulk outlets across Nigeria each month, in million litres.',
  how_to_read    = 'Higher values reflect greater transport and economic activity. Sudden drops may signal supply disruptions, price shocks, or fuel scarcity. Seasonal peaks typically occur around public holidays.',
  why_it_matters = 'PMS is the most consumed petroleum product in Nigeria and the primary fuel for road transport. Its availability and price directly affect household costs, inflation, and the productivity of the informal economy.',
  signal_rules   = '{"compare_to":"prev_period","unit_label":"million litres","threshold_warn":-15,"threshold_critical":-30,"direction":"higher_is_better","templates":{"above":"PMS sales are {pct}% higher than last period, indicating strong market supply.","neutral":"PMS sales are broadly stable compared to last period.","warn":"PMS sales dropped {pct}% from last period — possible supply constraint or demand shock.","critical":"PMS sales are down {pct}% from last period. This indicates a significant supply disruption."}}',
  geo_resolution = 'state'
WHERE id = 'pms_sales';

UPDATE series_types SET
  what_is        = 'The total volume of Automotive Gas Oil (diesel) sold through licensed distributors and major consumer sectors — transport, power generation, and industry — each month, in million litres.',
  how_to_read    = 'AGO is the primary backup fuel for generators and heavy transport. Rising AGO consumption often signals deteriorating grid electricity supply, as businesses fall back on self-generation.',
  why_it_matters = 'AGO consumption is a proxy indicator of Nigeria''s electricity supply gap. High and growing diesel demand imposes a significant cost burden on businesses and households, reducing competitiveness.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"million litres","threshold_warn":15,"threshold_critical":30,"direction":"lower_is_better","templates":{"above":"AGO sales are {pct}% above the 5-year average, likely reflecting deteriorating grid electricity supply.","neutral":"AGO consumption is broadly in line with the 5-year average.","warn":"AGO sales are elevated — {pct}% above average. Businesses are bearing higher self-generation costs.","critical":"AGO sales are {pct}% above the 5-year average, signalling a critical electricity supply failure."}}',
  geo_resolution = 'state'
WHERE id = 'ago_sales';

UPDATE series_types SET
  what_is        = 'The total volume of Dual Purpose Kerosene (household kerosene) distributed through licensed channels each month, in million litres.',
  how_to_read    = 'DPK is used for lighting and cooking by lower-income households without grid electricity or LPG access. Declining volumes may reflect a shift to LPG or solar, or simply supply reduction.',
  why_it_matters = 'Kerosene access is a direct measure of energy equity for rural and low-income households. It is also a health indicator — inadequate supply forces the use of firewood, increasing indoor air pollution.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"million litres","threshold_warn":-15,"threshold_critical":-35,"direction":"higher_is_better","templates":{"above":"DPK distribution is {pct}% above the 5-year average.","neutral":"DPK distribution is in line with the 5-year average.","warn":"DPK distribution is {pct}% below average — households may be underserved.","critical":"DPK distribution is {pct}% below the 5-year average, indicating a serious supply gap for vulnerable households."}}',
  geo_resolution = 'state'
WHERE id = 'kerosine_sales';

UPDATE series_types SET
  what_is        = 'The total volume of Liquefied Petroleum Gas (cooking gas) sold through licensed cylinders and bulk outlets across Nigeria each month, in metric tonnes.',
  how_to_read    = 'Rising LPG consumption indicates a shift away from firewood and kerosene toward cleaner cooking energy. Values are in metric tonnes — one standard 12.5 kg cylinder is 0.0125 metric tonnes.',
  why_it_matters = 'LPG adoption reduces deforestation, indoor air pollution, and cooking costs for households. The government''s National LPG Expansion Programme targets 5 million additional households annually.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"metric tonnes","threshold_warn":-10,"threshold_critical":-25,"direction":"higher_is_better","templates":{"above":"LPG sales are {pct}% above the 5-year average, reflecting growing clean cooking adoption.","neutral":"LPG sales are in line with the 5-year average.","warn":"LPG sales are {pct}% below average — supply or affordability constraints may be slowing adoption.","critical":"LPG sales are {pct}% below the 5-year average, a significant setback for clean cooking goals."}}',
  geo_resolution = 'lga'
WHERE id = 'lpg_sales';

UPDATE series_types SET
  what_is        = 'Total electricity generated at grid-connected power plants in Nigeria each month, covering thermal (gas), hydroelectric, and renewable sources. Measured in gigawatt-hours (GWh) at the plant busbar.',
  how_to_read    = 'This is gross generation — what the plants produce before accounting for their own energy use or transmission losses. Compare to ''Electricity Sent Out'' for net output, and to ''Electricity Consumption'' for what actually reaches end users.',
  why_it_matters = 'Generation capacity is the ceiling for Nigeria''s electricity supply. The gap between installed capacity (MW) and actual generation (GWh) reveals how much of the system is idle — a key indicator of infrastructure and fuel supply health.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"GWh","threshold_warn":-10,"threshold_critical":-20,"direction":"higher_is_better","templates":{"above":"Electricity generation is {pct}% above the 5-year average.","neutral":"Electricity generation is in line with the 5-year average.","warn":"Generation is {pct}% below the 5-year average — possible gas supply constraints or plant outages.","critical":"Generation is {pct}% below the 5-year average, indicating a serious supply deficit."}}',
  geo_resolution = 'national'
WHERE id = 'electricity_generation';

UPDATE series_types SET
  what_is        = 'Electricity dispatched from generating plants to the national transmission network each month — gross generation minus the plant''s own internal energy use (auxiliary consumption). Measured in GWh.',
  how_to_read    = 'Sent-out is what the grid actually receives. The difference between generation and sent-out is station own-use, typically 3–8% of gross generation. A widening gap suggests plant inefficiency.',
  why_it_matters = 'Sent-out energy is the true supply baseline for Nigeria''s grid. It directly determines how much power the Transmission Company of Nigeria (TCN) can wheel to distribution companies.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"GWh","threshold_warn":-10,"threshold_critical":-20,"direction":"higher_is_better","templates":{"above":"Sent-out power is {pct}% above the 5-year average.","neutral":"Sent-out power is in line with the 5-year average.","warn":"Sent-out power is {pct}% below average.","critical":"Sent-out power is {pct}% below the 5-year average — critical grid supply constraint."}}',
  geo_resolution = 'national'
WHERE id = 'electricity_sent_out';

UPDATE series_types SET
  what_is        = 'Electricity actually consumed by end users across all distribution company (DisCo) franchise areas each month, estimated from metered sales and loss factors. Measured in GWh.',
  how_to_read    = 'Consumption is always lower than generation and sent-out, because significant power is lost in transmission and distribution. Nigeria''s aggregate technical and commercial (ATC&C) losses typically run at 40–50%, meaning only half of generated electricity reaches paying customers.',
  why_it_matters = 'End-user consumption is the measure of electricity''s economic contribution. The gap between sent-out and consumption quantifies the scale of Nigeria''s infrastructure and governance challenge in the power sector.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"GWh","threshold_warn":-10,"threshold_critical":-20,"direction":"higher_is_better","templates":{"above":"Electricity consumption is {pct}% above the 5-year average.","neutral":"Consumption is broadly in line with the 5-year average.","warn":"Consumption is {pct}% below average, indicating grid supply constraints are affecting end users.","critical":"Consumption is {pct}% below the 5-year average — a critical shortfall affecting households and businesses."}}',
  geo_resolution = 'state'
WHERE id = 'electricity_consumption';

UPDATE series_types SET
  what_is        = 'Total installed renewable energy capacity connected to the national grid or operating as licensed off-grid systems, reported quarterly. Covers solar PV, wind, small hydro, and bioenergy. Measured in megawatts (MW).',
  how_to_read    = 'This is nameplate (installed) capacity, not actual generation. Actual output depends on capacity factor — solar typically runs at 15–20% in Nigeria, meaning 1,000 MW installed delivers roughly 150–200 MW on average.',
  why_it_matters = 'Renewable capacity growth is the indicator of Nigeria''s energy transition progress. It directly affects the country''s ability to meet its Nationally Determined Contribution (NDC) targets under the Paris Agreement.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"MW","threshold_warn":-5,"threshold_critical":-15,"direction":"higher_is_better","templates":{"above":"Renewable capacity is {pct}% above the 5-year average, indicating strong energy transition momentum.","neutral":"Renewable capacity growth is in line with trend.","warn":"Renewable capacity addition is slowing — {pct}% below average trajectory.","critical":"Renewable capacity addition is {pct}% below the 5-year average trend, signalling a stalled transition."}}',
  geo_resolution = 'lga'
WHERE id = 'renewable_energy';

UPDATE series_types SET
  what_is        = 'Estimated volume of fuelwood (firewood and charcoal combined, converted to wood equivalent) consumed by households and commercial users each quarter, by state. Measured in thousand metric tonnes.',
  how_to_read    = 'Higher fuelwood consumption indicates lower access to modern cooking energy (LPG, electricity). Charcoal is converted to wood at a 6:1 ratio. These are estimates from surveys — treat as indicative, not precise.',
  why_it_matters = 'Fuelwood dependency drives deforestation, desertification, and indoor air pollution. It is the primary fuel for over 70% of Nigerian households and a key indicator of energy poverty and climate vulnerability.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"thousand metric tonnes","threshold_warn":10,"threshold_critical":20,"direction":"lower_is_better","templates":{"above":"Fuelwood consumption is {pct}% above the 5-year average — energy poverty indicators are worsening.","neutral":"Fuelwood consumption is broadly in line with the 5-year average.","warn":"Fuelwood consumption is elevated at {pct}% above average, suggesting limited clean cooking access.","critical":"Fuelwood consumption is {pct}% above the 5-year average — a critical energy poverty signal."}}',
  geo_resolution = 'lga'
WHERE id = 'fuelwood_consumption';

UPDATE series_types SET
  what_is        = 'Federal Government of Nigeria oil and gas revenue allocated through the Federation Account Allocation Committee (FAAC) each quarter, in billions of naira. Covers crude oil proceeds, PPT, royalties, and signature bonuses.',
  how_to_read    = 'This is cash distributed to federal, state, and local governments — not accruals. Higher FAAC oil revenue generally means more fiscal headroom for capital spending across all tiers of government.',
  why_it_matters = 'FAAC oil revenue is the financial lifeline of Nigeria''s federal system. All 36 states and 774 LGAs receive statutory allocations derived from this pool. Volatility here directly translates to public service disruptions nationwide.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"₦ billion","threshold_warn":-15,"threshold_critical":-30,"direction":"higher_is_better","templates":{"above":"FAAC oil revenue is {pct}% above the 5-year average — stronger fiscal position for all tiers.","neutral":"FAAC oil revenue is in line with the 5-year average.","warn":"FAAC oil revenue is {pct}% below average — reduced allocations to states and LGAs.","critical":"FAAC oil revenue is {pct}% below the 5-year average. This has direct implications for public spending at all government levels."}}',
  geo_resolution = 'national'
WHERE id = 'faac_oil_revenue';

UPDATE series_types SET
  what_is        = 'Royalties collected by NUPRC from upstream oil and gas producers each quarter, in billions of naira. Includes oil royalties, gas royalties, and surface rent assessed under the Petroleum Industry Act 2021.',
  how_to_read    = 'Royalty rates are set by statute and vary by terrain type (onshore, shallow water, deepwater). Higher production volumes and higher crude prices both increase royalty receipts. These are cash receipts, not accruals.',
  why_it_matters = 'Upstream royalties are a key non-tax revenue stream for the Federation Account. Unlike PPT (which can be reduced by deductible costs), royalties are assessed on gross production — making them a more stable revenue floor.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"₦ billion","threshold_warn":-15,"threshold_critical":-30,"direction":"higher_is_better","templates":{"above":"Upstream royalties are {pct}% above the 5-year average.","neutral":"Upstream royalties are in line with the 5-year average.","warn":"Royalty receipts are {pct}% below average — likely driven by lower production volumes or crude prices.","critical":"Royalty receipts are {pct}% below the 5-year average, a significant shortfall in non-tax revenue."}}',
  geo_resolution = 'national'
WHERE id = 'upstream_royalties';
