-- ══════════════════════════════════════════════════════════════════════════════
-- NEDB — Complete Migration 013 → 015
-- Run this entire script in the Supabase SQL editor in one shot.
-- ══════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────────────
-- 013: Series explanation metadata + signal rules + geo resolution
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE series_types
  ADD COLUMN IF NOT EXISTS what_is        TEXT,
  ADD COLUMN IF NOT EXISTS how_to_read    TEXT,
  ADD COLUMN IF NOT EXISTS why_it_matters TEXT,
  ADD COLUMN IF NOT EXISTS signal_rules   JSONB,
  ADD COLUMN IF NOT EXISTS geo_resolution TEXT NOT NULL DEFAULT 'national'
    CHECK (geo_resolution IN ('national','state','lga'));

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
  how_to_read    = 'This is gross generation — what the plants produce before accounting for their own energy use or transmission losses. Compare to Electricity Sent Out for net output, and to Electricity Consumption for what actually reaches end users.',
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
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"NGN billion","threshold_warn":-15,"threshold_critical":-30,"direction":"higher_is_better","templates":{"above":"FAAC oil revenue is {pct}% above the 5-year average — stronger fiscal position for all tiers.","neutral":"FAAC oil revenue is in line with the 5-year average.","warn":"FAAC oil revenue is {pct}% below average — reduced allocations to states and LGAs.","critical":"FAAC oil revenue is {pct}% below the 5-year average. This has direct implications for public spending at all government levels."}}',
  geo_resolution = 'national'
WHERE id = 'faac_oil_revenue';

UPDATE series_types SET
  what_is        = 'Royalties collected by NUPRC from upstream oil and gas producers each quarter, in billions of naira. Includes oil royalties, gas royalties, and surface rent assessed under the Petroleum Industry Act 2021.',
  how_to_read    = 'Royalty rates are set by statute and vary by terrain type (onshore, shallow water, deepwater). Higher production volumes and higher crude prices both increase royalty receipts. These are cash receipts, not accruals.',
  why_it_matters = 'Upstream royalties are a key non-tax revenue stream for the Federation Account. Unlike PPT (which can be reduced by deductible costs), royalties are assessed on gross production — making them a more stable revenue floor.',
  signal_rules   = '{"compare_to":"5yr_avg","unit_label":"NGN billion","threshold_warn":-15,"threshold_critical":-30,"direction":"higher_is_better","templates":{"above":"Upstream royalties are {pct}% above the 5-year average.","neutral":"Upstream royalties are in line with the 5-year average.","warn":"Royalty receipts are {pct}% below average — likely driven by lower production volumes or crude prices.","critical":"Royalty receipts are {pct}% below the 5-year average, a significant shortfall in non-tax revenue."}}',
  geo_resolution = 'national'
WHERE id = 'upstream_royalties';


-- ────────────────────────────────────────────────────────────────────────────
-- 014: LGAs table (all 774) + lga_id on energy_records
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lgas (
  id         BIGSERIAL PRIMARY KEY,
  lga_code   TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  state_code TEXT NOT NULL,
  state_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgas_state_code ON lgas(state_code);

ALTER TABLE energy_records
  ADD COLUMN IF NOT EXISTS lga_id BIGINT REFERENCES lgas(id);

CREATE INDEX IF NOT EXISTS idx_records_lga ON energy_records(lga_id)
  WHERE lga_id IS NOT NULL;

ALTER TABLE lgas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_lgas"   ON lgas FOR SELECT USING (true);
CREATE POLICY "service_role_lgas"  ON lgas USING (true) WITH CHECK (true);

INSERT INTO lgas (lga_code, name, state_code, state_name) VALUES
-- ABIA (17)
('NG-AB-ABN','Aba North','NG-AB','Abia'),('NG-AB-ABS','Aba South','NG-AB','Abia'),
('NG-AB-ARO','Arochukwu','NG-AB','Abia'),('NG-AB-BEN','Bende','NG-AB','Abia'),
('NG-AB-IKW','Ikwuano','NG-AB','Abia'),('NG-AB-INN','Isiala Ngwa North','NG-AB','Abia'),
('NG-AB-INS','Isiala Ngwa South','NG-AB','Abia'),('NG-AB-ISU','Isuikwuato','NG-AB','Abia'),
('NG-AB-OBN','Obi Ngwa','NG-AB','Abia'),('NG-AB-OHA','Ohafia','NG-AB','Abia'),
('NG-AB-OSI','Osisioma','NG-AB','Abia'),('NG-AB-UGW','Ugwunagbo','NG-AB','Abia'),
('NG-AB-UKE','Ukwa East','NG-AB','Abia'),('NG-AB-UKW','Ukwa West','NG-AB','Abia'),
('NG-AB-UMN','Umuahia North','NG-AB','Abia'),('NG-AB-UMS','Umuahia South','NG-AB','Abia'),
('NG-AB-UNN','Umu Nneochi','NG-AB','Abia'),
-- ADAMAWA (21)
('NG-AD-DEM','Demsa','NG-AD','Adamawa'),('NG-AD-FUF','Fufore','NG-AD','Adamawa'),
('NG-AD-GAN','Ganye','NG-AD','Adamawa'),('NG-AD-GIR','Girei','NG-AD','Adamawa'),
('NG-AD-GOM','Gombi','NG-AD','Adamawa'),('NG-AD-GUY','Guyuk','NG-AD','Adamawa'),
('NG-AD-HON','Hong','NG-AD','Adamawa'),('NG-AD-JAD','Jada','NG-AD','Adamawa'),
('NG-AD-LAM','Lamurde','NG-AD','Adamawa'),('NG-AD-MAD','Madagali','NG-AD','Adamawa'),
('NG-AD-MAI','Maiha','NG-AD','Adamawa'),('NG-AD-MAY','Mayo Belwa','NG-AD','Adamawa'),
('NG-AD-MIC','Michika','NG-AD','Adamawa'),('NG-AD-MBN','Mubi North','NG-AD','Adamawa'),
('NG-AD-MBS','Mubi South','NG-AD','Adamawa'),('NG-AD-NUM','Numan','NG-AD','Adamawa'),
('NG-AD-SHE','Shelleng','NG-AD','Adamawa'),('NG-AD-SON','Song','NG-AD','Adamawa'),
('NG-AD-TOU','Toungo','NG-AD','Adamawa'),('NG-AD-YON','Yola North','NG-AD','Adamawa'),
('NG-AD-YOS','Yola South','NG-AD','Adamawa'),
-- AKWA IBOM (31)
('NG-AK-ABA','Abak','NG-AK','Akwa Ibom'),('NG-AK-EAO','Eastern Obolo','NG-AK','Akwa Ibom'),
('NG-AK-EKE','Eket','NG-AK','Akwa Ibom'),('NG-AK-ESE','Esit Eket','NG-AK','Akwa Ibom'),
('NG-AK-ESU','Essien Udim','NG-AK','Akwa Ibom'),('NG-AK-ETI','Etim Ekpo','NG-AK','Akwa Ibom'),
('NG-AK-ETN','Etinan','NG-AK','Akwa Ibom'),('NG-AK-IBE','Ibeno','NG-AK','Akwa Ibom'),
('NG-AK-IBA','Ibesikpo Asutan','NG-AK','Akwa Ibom'),('NG-AK-IBI','Ibiono Ibom','NG-AK','Akwa Ibom'),
('NG-AK-IKA','Ika','NG-AK','Akwa Ibom'),('NG-AK-IKN','Ikono','NG-AK','Akwa Ibom'),
('NG-AK-IKB','Ikot Abasi','NG-AK','Akwa Ibom'),('NG-AK-IKP','Ikot Ekpene','NG-AK','Akwa Ibom'),
('NG-AK-INI','Ini','NG-AK','Akwa Ibom'),('NG-AK-ITU','Itu','NG-AK','Akwa Ibom'),
('NG-AK-MBO','Mbo','NG-AK','Akwa Ibom'),('NG-AK-MKP','Mkpat Enin','NG-AK','Akwa Ibom'),
('NG-AK-NSA','Nsit Atai','NG-AK','Akwa Ibom'),('NG-AK-NSI','Nsit Ibom','NG-AK','Akwa Ibom'),
('NG-AK-NSU','Nsit Ubium','NG-AK','Akwa Ibom'),('NG-AK-OBO','Obot Akara','NG-AK','Akwa Ibom'),
('NG-AK-OKO','Okobo','NG-AK','Akwa Ibom'),('NG-AK-ONN','Onna','NG-AK','Akwa Ibom'),
('NG-AK-ORO','Oron','NG-AK','Akwa Ibom'),('NG-AK-ORU','Oruk Anam','NG-AK','Akwa Ibom'),
('NG-AK-UDU','Udung Uko','NG-AK','Akwa Ibom'),('NG-AK-UKA','Ukanafun','NG-AK','Akwa Ibom'),
('NG-AK-URU','Uruan','NG-AK','Akwa Ibom'),('NG-AK-URF','Urue Offong/Oruko','NG-AK','Akwa Ibom'),
('NG-AK-UYO','Uyo','NG-AK','Akwa Ibom'),
-- ANAMBRA (21)
('NG-AN-AGU','Aguata','NG-AN','Anambra'),('NG-AN-ANE','Anambra East','NG-AN','Anambra'),
('NG-AN-ANW','Anambra West','NG-AN','Anambra'),('NG-AN-ANA','Anaocha','NG-AN','Anambra'),
('NG-AN-AWN','Awka North','NG-AN','Anambra'),('NG-AN-AWS','Awka South','NG-AN','Anambra'),
('NG-AN-AYA','Ayamelum','NG-AN','Anambra'),('NG-AN-DUN','Dunukofia','NG-AN','Anambra'),
('NG-AN-EKW','Ekwusigo','NG-AN','Anambra'),('NG-AN-IDN','Idemili North','NG-AN','Anambra'),
('NG-AN-IDS','Idemili South','NG-AN','Anambra'),('NG-AN-IHI','Ihiala','NG-AN','Anambra'),
('NG-AN-NJI','Njikoka','NG-AN','Anambra'),('NG-AN-NNN','Nnewi North','NG-AN','Anambra'),
('NG-AN-NNS','Nnewi South','NG-AN','Anambra'),('NG-AN-OGB','Ogbaru','NG-AN','Anambra'),
('NG-AN-ONT','Onitsha North','NG-AN','Anambra'),('NG-AN-ONS','Onitsha South','NG-AN','Anambra'),
('NG-AN-ORN','Orumba North','NG-AN','Anambra'),('NG-AN-ORS','Orumba South','NG-AN','Anambra'),
('NG-AN-OYI','Oyi','NG-AN','Anambra'),
-- BAUCHI (20)
('NG-BA-ALK','Alkaleri','NG-BA','Bauchi'),('NG-BA-BAU','Bauchi','NG-BA','Bauchi'),
('NG-BA-BOG','Bogoro','NG-BA','Bauchi'),('NG-BA-DAM','Damban','NG-BA','Bauchi'),
('NG-BA-DAR','Darazo','NG-BA','Bauchi'),('NG-BA-DAS','Dass','NG-BA','Bauchi'),
('NG-BA-GAM','Gamawa','NG-BA','Bauchi'),('NG-BA-GAN','Ganjuwa','NG-BA','Bauchi'),
('NG-BA-GIA','Giade','NG-BA','Bauchi'),('NG-BA-ITA','Itas/Gadau','NG-BA','Bauchi'),
('NG-BA-JAM','Jamaa','NG-BA','Bauchi'),('NG-BA-KAT','Katagum','NG-BA','Bauchi'),
('NG-BA-KIR','Kirfi','NG-BA','Bauchi'),('NG-BA-MIS','Misau','NG-BA','Bauchi'),
('NG-BA-NIN','Ningi','NG-BA','Bauchi'),('NG-BA-SHI','Shira','NG-BA','Bauchi'),
('NG-BA-TAF','Tafawa Balewa','NG-BA','Bauchi'),('NG-BA-TOR','Toro','NG-BA','Bauchi'),
('NG-BA-WAR','Warji','NG-BA','Bauchi'),('NG-BA-ZAK','Zaki','NG-BA','Bauchi'),
-- BAYELSA (8)
('NG-BY-BRA','Brass','NG-BY','Bayelsa'),('NG-BY-EKE','Ekeremor','NG-BY','Bayelsa'),
('NG-BY-KOL','Kolokuma/Opokuma','NG-BY','Bayelsa'),('NG-BY-NEM','Nembe','NG-BY','Bayelsa'),
('NG-BY-OGB','Ogbia','NG-BY','Bayelsa'),('NG-BY-SAG','Sagbama','NG-BY','Bayelsa'),
('NG-BY-SIJ','Southern Ijaw','NG-BY','Bayelsa'),('NG-BY-YEN','Yenagoa','NG-BY','Bayelsa'),
-- BENUE (23)
('NG-BE-ADO','Ado','NG-BE','Benue'),('NG-BE-AGA','Agatu','NG-BE','Benue'),
('NG-BE-APA','Apa','NG-BE','Benue'),('NG-BE-BUR','Buruku','NG-BE','Benue'),
('NG-BE-GBO','Gboko','NG-BE','Benue'),('NG-BE-GUM','Guma','NG-BE','Benue'),
('NG-BE-GWE','Gwer East','NG-BE','Benue'),('NG-BE-GWW','Gwer West','NG-BE','Benue'),
('NG-BE-KAL','Katsina-Ala','NG-BE','Benue'),('NG-BE-KON','Konshisha','NG-BE','Benue'),
('NG-BE-KWA','Kwande','NG-BE','Benue'),('NG-BE-LOG','Logo','NG-BE','Benue'),
('NG-BE-MAK','Makurdi','NG-BE','Benue'),('NG-BE-OBI','Obi','NG-BE','Benue'),
('NG-BE-OGD','Ogbadibo','NG-BE','Benue'),('NG-BE-OHI','Ohimini','NG-BE','Benue'),
('NG-BE-OJU','Oju','NG-BE','Benue'),('NG-BE-OKP','Okpokwu','NG-BE','Benue'),
('NG-BE-OTU','Otukpo','NG-BE','Benue'),('NG-BE-TAR','Tarka','NG-BE','Benue'),
('NG-BE-UKU','Ukum','NG-BE','Benue'),('NG-BE-USH','Ushongo','NG-BE','Benue'),
('NG-BE-VAN','Vandeikya','NG-BE','Benue'),
-- BORNO (27)
('NG-BO-ABA','Abadam','NG-BO','Borno'),('NG-BO-ASK','Askira/Uba','NG-BO','Borno'),
('NG-BO-BAM','Bama','NG-BO','Borno'),('NG-BO-BAY','Bayo','NG-BO','Borno'),
('NG-BO-BIU','Biu','NG-BO','Borno'),('NG-BO-CHI','Chibok','NG-BO','Borno'),
('NG-BO-DAM','Damboa','NG-BO','Borno'),('NG-BO-DIK','Dikwa','NG-BO','Borno'),
('NG-BO-GUB','Gubio','NG-BO','Borno'),('NG-BO-GUZ','Guzamala','NG-BO','Borno'),
('NG-BO-GWO','Gwoza','NG-BO','Borno'),('NG-BO-HAW','Hawul','NG-BO','Borno'),
('NG-BO-JER','Jere','NG-BO','Borno'),('NG-BO-KAG','Kaga','NG-BO','Borno'),
('NG-BO-KLB','Kala/Balge','NG-BO','Borno'),('NG-BO-KON','Konduga','NG-BO','Borno'),
('NG-BO-KUK','Kukawa','NG-BO','Borno'),('NG-BO-KWK','Kwaya Kusar','NG-BO','Borno'),
('NG-BO-MAF','Mafa','NG-BO','Borno'),('NG-BO-MAG','Magumeri','NG-BO','Borno'),
('NG-BO-MDG','Maiduguri','NG-BO','Borno'),('NG-BO-MAR','Marte','NG-BO','Borno'),
('NG-BO-MOB','Mobbar','NG-BO','Borno'),('NG-BO-MON','Monguno','NG-BO','Borno'),
('NG-BO-NGA','Ngala','NG-BO','Borno'),('NG-BO-NGZ','Nganzai','NG-BO','Borno'),
('NG-BO-SHA','Shani','NG-BO','Borno'),
-- CROSS RIVER (18)
('NG-CR-ABI','Abi','NG-CR','Cross River'),('NG-CR-AKA','Akamkpa','NG-CR','Cross River'),
('NG-CR-AKP','Akpabuyo','NG-CR','Cross River'),('NG-CR-BAK','Bakassi','NG-CR','Cross River'),
('NG-CR-BEK','Bekwarra','NG-CR','Cross River'),('NG-CR-BIA','Biase','NG-CR','Cross River'),
('NG-CR-BOK','Boki','NG-CR','Cross River'),('NG-CR-CLM','Calabar Municipal','NG-CR','Cross River'),
('NG-CR-CLS','Calabar South','NG-CR','Cross River'),('NG-CR-ETU','Etung','NG-CR','Cross River'),
('NG-CR-IKO','Ikom','NG-CR','Cross River'),('NG-CR-OBL','Obanliku','NG-CR','Cross River'),
('NG-CR-OBR','Obubra','NG-CR','Cross River'),('NG-CR-OBD','Obudu','NG-CR','Cross River'),
('NG-CR-ODU','Odukpani','NG-CR','Cross River'),('NG-CR-OGO','Ogoja','NG-CR','Cross River'),
('NG-CR-YAK','Yakuur','NG-CR','Cross River'),('NG-CR-YAL','Yala','NG-CR','Cross River'),
-- DELTA (25)
('NG-DE-ANN','Aniocha North','NG-DE','Delta'),('NG-DE-ANS','Aniocha South','NG-DE','Delta'),
('NG-DE-BOM','Bomadi','NG-DE','Delta'),('NG-DE-BUR','Burutu','NG-DE','Delta'),
('NG-DE-ETE','Ethiope East','NG-DE','Delta'),('NG-DE-ETW','Ethiope West','NG-DE','Delta'),
('NG-DE-IKN','Ika North East','NG-DE','Delta'),('NG-DE-IKS','Ika South','NG-DE','Delta'),
('NG-DE-ISN','Isoko North','NG-DE','Delta'),('NG-DE-ISS','Isoko South','NG-DE','Delta'),
('NG-DE-NDE','Ndokwa East','NG-DE','Delta'),('NG-DE-NDW','Ndokwa West','NG-DE','Delta'),
('NG-DE-OKP','Okpe','NG-DE','Delta'),('NG-DE-OSN','Oshimili North','NG-DE','Delta'),
('NG-DE-OSS','Oshimili South','NG-DE','Delta'),('NG-DE-PAT','Patani','NG-DE','Delta'),
('NG-DE-SAP','Sapele','NG-DE','Delta'),('NG-DE-UDU','Udu','NG-DE','Delta'),
('NG-DE-UGN','Ughelli North','NG-DE','Delta'),('NG-DE-UGS','Ughelli South','NG-DE','Delta'),
('NG-DE-UKW','Ukwuani','NG-DE','Delta'),('NG-DE-UVW','Uvwie','NG-DE','Delta'),
('NG-DE-WRN','Warri North','NG-DE','Delta'),('NG-DE-WRS','Warri South','NG-DE','Delta'),
('NG-DE-WRW','Warri South West','NG-DE','Delta'),
-- EBONYI (13)
('NG-EB-ABA','Abakaliki','NG-EB','Ebonyi'),('NG-EB-AFN','Afikpo North','NG-EB','Ebonyi'),
('NG-EB-AFS','Afikpo South','NG-EB','Ebonyi'),('NG-EB-EBO','Ebonyi','NG-EB','Ebonyi'),
('NG-EB-EZN','Ezza North','NG-EB','Ebonyi'),('NG-EB-EZS','Ezza South','NG-EB','Ebonyi'),
('NG-EB-IKW','Ikwo','NG-EB','Ebonyi'),('NG-EB-ISH','Ishielu','NG-EB','Ebonyi'),
('NG-EB-IVO','Ivo','NG-EB','Ebonyi'),('NG-EB-IZZ','Izzi','NG-EB','Ebonyi'),
('NG-EB-OHA','Ohaozara','NG-EB','Ebonyi'),('NG-EB-OHK','Ohaukwu','NG-EB','Ebonyi'),
('NG-EB-ONI','Onicha','NG-EB','Ebonyi'),
-- EDO (18)
('NG-ED-AKE','Akoko-Edo','NG-ED','Edo'),('NG-ED-EGO','Egor','NG-ED','Edo'),
('NG-ED-ESC','Esan Central','NG-ED','Edo'),('NG-ED-ESN','Esan North East','NG-ED','Edo'),
('NG-ED-ESS','Esan South East','NG-ED','Edo'),('NG-ED-ESW','Esan West','NG-ED','Edo'),
('NG-ED-ETC','Etsako Central','NG-ED','Edo'),('NG-ED-ETE','Etsako East','NG-ED','Edo'),
('NG-ED-ETW','Etsako West','NG-ED','Edo'),('NG-ED-IGU','Igueben','NG-ED','Edo'),
('NG-ED-IKP','Ikpoba-Okha','NG-ED','Edo'),('NG-ED-ORH','Orhionmwon','NG-ED','Edo'),
('NG-ED-ORE','Oredo','NG-ED','Edo'),('NG-ED-OVN','Ovia North East','NG-ED','Edo'),
('NG-ED-OVS','Ovia South West','NG-ED','Edo'),('NG-ED-OWE','Owan East','NG-ED','Edo'),
('NG-ED-OWW','Owan West','NG-ED','Edo'),('NG-ED-UHU','Uhunmwonde','NG-ED','Edo'),
-- EKITI (16)
('NG-EK-ADO','Ado Ekiti','NG-EK','Ekiti'),('NG-EK-EFO','Efon','NG-EK','Ekiti'),
('NG-EK-EKE','Ekiti East','NG-EK','Ekiti'),('NG-EK-EKS','Ekiti South West','NG-EK','Ekiti'),
('NG-EK-EKW','Ekiti West','NG-EK','Ekiti'),('NG-EK-EMU','Emure','NG-EK','Ekiti'),
('NG-EK-GBO','Gbonyin','NG-EK','Ekiti'),('NG-EK-IDO','Ido Osi','NG-EK','Ekiti'),
('NG-EK-IJE','Ijero','NG-EK','Ekiti'),('NG-EK-IKR','Ikere','NG-EK','Ekiti'),
('NG-EK-IKL','Ikole','NG-EK','Ekiti'),('NG-EK-ILJ','Ilejemeje','NG-EK','Ekiti'),
('NG-EK-IRP','Irepodun/Ifelodun','NG-EK','Ekiti'),('NG-EK-ISE','Ise/Orun','NG-EK','Ekiti'),
('NG-EK-MOB','Moba','NG-EK','Ekiti'),('NG-EK-OYE','Oye','NG-EK','Ekiti'),
-- ENUGU (17)
('NG-EN-ANI','Aninri','NG-EN','Enugu'),('NG-EN-AWG','Awgu','NG-EN','Enugu'),
('NG-EN-ENE','Enugu East','NG-EN','Enugu'),('NG-EN-ENN','Enugu North','NG-EN','Enugu'),
('NG-EN-ENS','Enugu South','NG-EN','Enugu'),('NG-EN-EZE','Ezeagu','NG-EN','Enugu'),
('NG-EN-IGE','Igbo Etiti','NG-EN','Enugu'),('NG-EN-IGN','Igbo Eze North','NG-EN','Enugu'),
('NG-EN-IGS','Igbo Eze South','NG-EN','Enugu'),('NG-EN-ISI','Isi Uzo','NG-EN','Enugu'),
('NG-EN-NKE','Nkanu East','NG-EN','Enugu'),('NG-EN-NKW','Nkanu West','NG-EN','Enugu'),
('NG-EN-NSU','Nsukka','NG-EN','Enugu'),('NG-EN-OJI','Oji River','NG-EN','Enugu'),
('NG-EN-UDE','Udenu','NG-EN','Enugu'),('NG-EN-UDI','Udi','NG-EN','Enugu'),
('NG-EN-UZO','Uzo Uwani','NG-EN','Enugu'),
-- GOMBE (11)
('NG-GO-AKK','Akko','NG-GO','Gombe'),('NG-GO-BAL','Balanga','NG-GO','Gombe'),
('NG-GO-BIL','Billiri','NG-GO','Gombe'),('NG-GO-DUK','Dukku','NG-GO','Gombe'),
('NG-GO-FUN','Funakaye','NG-GO','Gombe'),('NG-GO-GMB','Gombe','NG-GO','Gombe'),
('NG-GO-KAL','Kaltungo','NG-GO','Gombe'),('NG-GO-KWA','Kwami','NG-GO','Gombe'),
('NG-GO-NAF','Nafada','NG-GO','Gombe'),('NG-GO-SHO','Shomgom','NG-GO','Gombe'),
('NG-GO-YAM','Yamaltu/Deba','NG-GO','Gombe'),
-- IMO (27)
('NG-IM-ABM','Aboh Mbaise','NG-IM','Imo'),('NG-IM-AHM','Ahiazu Mbaise','NG-IM','Imo'),
('NG-IM-EHM','Ehime Mbano','NG-IM','Imo'),('NG-IM-EZI','Ezinihitte','NG-IM','Imo'),
('NG-IM-IDN','Ideato North','NG-IM','Imo'),('NG-IM-IDS','Ideato South','NG-IM','Imo'),
('NG-IM-IHU','Ihitte/Uboma','NG-IM','Imo'),('NG-IM-IKE','Ikeduru','NG-IM','Imo'),
('NG-IM-ISM','Isiala Mbano','NG-IM','Imo'),('NG-IM-ISU','Isu','NG-IM','Imo'),
('NG-IM-MBA','Mbaitoli','NG-IM','Imo'),('NG-IM-NGO','Ngor Okpala','NG-IM','Imo'),
('NG-IM-NJA','Njaba','NG-IM','Imo'),('NG-IM-NKW','Nkwerre','NG-IM','Imo'),
('NG-IM-NWA','Nwangele','NG-IM','Imo'),('NG-IM-OBO','Obowo','NG-IM','Imo'),
('NG-IM-OGU','Oguta','NG-IM','Imo'),('NG-IM-OHJ','Ohaji/Egbema','NG-IM','Imo'),
('NG-IM-OKI','Okigwe','NG-IM','Imo'),('NG-IM-ONU','Onuimo','NG-IM','Imo'),
('NG-IM-ORL','Orlu','NG-IM','Imo'),('NG-IM-ORS','Orsu','NG-IM','Imo'),
('NG-IM-ORE','Oru East','NG-IM','Imo'),('NG-IM-ORW','Oru West','NG-IM','Imo'),
('NG-IM-OWM','Owerri Municipal','NG-IM','Imo'),('NG-IM-OWN','Owerri North','NG-IM','Imo'),
('NG-IM-OWW','Owerri West','NG-IM','Imo'),
-- JIGAWA (27)
('NG-JI-AUY','Auyo','NG-JI','Jigawa'),('NG-JI-BAB','Babura','NG-JI','Jigawa'),
('NG-JI-BIR','Biriniwa','NG-JI','Jigawa'),('NG-JI-BKD','Birnin Kudu','NG-JI','Jigawa'),
('NG-JI-BUJ','Buji','NG-JI','Jigawa'),('NG-JI-DUT','Dutse','NG-JI','Jigawa'),
('NG-JI-GAG','Gagarawa','NG-JI','Jigawa'),('NG-JI-GAR','Garki','NG-JI','Jigawa'),
('NG-JI-GUM','Gumel','NG-JI','Jigawa'),('NG-JI-GUR','Guri','NG-JI','Jigawa'),
('NG-JI-GWR','Gwaram','NG-JI','Jigawa'),('NG-JI-GWI','Gwiwa','NG-JI','Jigawa'),
('NG-JI-HAD','Hadejia','NG-JI','Jigawa'),('NG-JI-JAH','Jahun','NG-JI','Jigawa'),
('NG-JI-KFH','Kafin Hausa','NG-JI','Jigawa'),('NG-JI-KAU','Kaugama','NG-JI','Jigawa'),
('NG-JI-KAZ','Kazaure','NG-JI','Jigawa'),('NG-JI-KIR','Kiri Kasama','NG-JI','Jigawa'),
('NG-JI-KIY','Kiyawa','NG-JI','Jigawa'),('NG-JI-MAI','Maigatari','NG-JI','Jigawa'),
('NG-JI-MAL','Malam Maduri','NG-JI','Jigawa'),('NG-JI-MIG','Miga','NG-JI','Jigawa'),
('NG-JI-RIN','Ringim','NG-JI','Jigawa'),('NG-JI-RON','Roni','NG-JI','Jigawa'),
('NG-JI-SUL','Sule Tankarkar','NG-JI','Jigawa'),('NG-JI-TAU','Taura','NG-JI','Jigawa'),
('NG-JI-YAN','Yankwashi','NG-JI','Jigawa'),
-- KADUNA (23)
('NG-KD-BGW','Birnin Gwari','NG-KD','Kaduna'),('NG-KD-CHI','Chikun','NG-KD','Kaduna'),
('NG-KD-GIW','Giwa','NG-KD','Kaduna'),('NG-KD-IGA','Igabi','NG-KD','Kaduna'),
('NG-KD-IKA','Ikara','NG-KD','Kaduna'),('NG-KD-JAB','Jaba','NG-KD','Kaduna'),
('NG-KD-JEM','Jema''a','NG-KD','Kaduna'),('NG-KD-KAC','Kachia','NG-KD','Kaduna'),
('NG-KD-KDN','Kaduna North','NG-KD','Kaduna'),('NG-KD-KDS','Kaduna South','NG-KD','Kaduna'),
('NG-KD-KAG','Kagarko','NG-KD','Kaduna'),('NG-KD-KAJ','Kajuru','NG-KD','Kaduna'),
('NG-KD-KAU','Kaura','NG-KD','Kaduna'),('NG-KD-KAR','Kauru','NG-KD','Kaduna'),
('NG-KD-KUB','Kubau','NG-KD','Kaduna'),('NG-KD-KUD','Kudan','NG-KD','Kaduna'),
('NG-KD-LER','Lere','NG-KD','Kaduna'),('NG-KD-MAK','Makarfi','NG-KD','Kaduna'),
('NG-KD-SAB','Sabon Gari','NG-KD','Kaduna'),('NG-KD-SAN','Sanga','NG-KD','Kaduna'),
('NG-KD-SOB','Soba','NG-KD','Kaduna'),('NG-KD-ZAN','Zangon Kataf','NG-KD','Kaduna'),
('NG-KD-ZAR','Zaria','NG-KD','Kaduna'),
-- KANO (44)
('NG-KN-AJI','Ajingi','NG-KN','Kano'),('NG-KN-ALB','Albasu','NG-KN','Kano'),
('NG-KN-BAG','Bagwai','NG-KN','Kano'),('NG-KN-BEB','Bebeji','NG-KN','Kano'),
('NG-KN-BIC','Bichi','NG-KN','Kano'),('NG-KN-BUN','Bunkure','NG-KN','Kano'),
('NG-KN-DAL','Dala','NG-KN','Kano'),('NG-KN-DAM','Dambatta','NG-KN','Kano'),
('NG-KN-DKD','Dawakin Kudu','NG-KN','Kano'),('NG-KN-DKT','Dawakin Tofa','NG-KN','Kano'),
('NG-KN-DOG','Doguwa','NG-KN','Kano'),('NG-KN-FAG','Fagge','NG-KN','Kano'),
('NG-KN-GAB','Gabasawa','NG-KN','Kano'),('NG-KN-GAR','Garko','NG-KN','Kano'),
('NG-KN-GAM','Garun Mallam','NG-KN','Kano'),('NG-KN-GAY','Gaya','NG-KN','Kano'),
('NG-KN-GEZ','Gezawa','NG-KN','Kano'),('NG-KN-GWL','Gwale','NG-KN','Kano'),
('NG-KN-GWZ','Gwarzo','NG-KN','Kano'),('NG-KN-KAB','Kabo','NG-KN','Kano'),
('NG-KN-KNM','Kano Municipal','NG-KN','Kano'),('NG-KN-KAR','Karaye','NG-KN','Kano'),
('NG-KN-KIB','Kibiya','NG-KN','Kano'),('NG-KN-KIR','Kiru','NG-KN','Kano'),
('NG-KN-KUM','Kumbotso','NG-KN','Kano'),('NG-KN-KUN','Kunchi','NG-KN','Kano'),
('NG-KN-KUR','Kura','NG-KN','Kano'),('NG-KN-MAD','Madobi','NG-KN','Kano'),
('NG-KN-MAK','Makoda','NG-KN','Kano'),('NG-KN-MIN','Minjibir','NG-KN','Kano'),
('NG-KN-NAS','Nasarawa','NG-KN','Kano'),('NG-KN-RAN','Rano','NG-KN','Kano'),
('NG-KN-RMG','Rimin Gado','NG-KN','Kano'),('NG-KN-ROG','Rogo','NG-KN','Kano'),
('NG-KN-SHA','Shanono','NG-KN','Kano'),('NG-KN-SUM','Sumaila','NG-KN','Kano'),
('NG-KN-TAK','Takai','NG-KN','Kano'),('NG-KN-TAR','Tarauni','NG-KN','Kano'),
('NG-KN-TOF','Tofa','NG-KN','Kano'),('NG-KN-TSA','Tsanyawa','NG-KN','Kano'),
('NG-KN-TUD','Tudun Wada','NG-KN','Kano'),('NG-KN-UNG','Ungogo','NG-KN','Kano'),
('NG-KN-WAR','Warawa','NG-KN','Kano'),('NG-KN-WUD','Wudil','NG-KN','Kano'),
-- KATSINA (34)
('NG-KT-BAK','Bakori','NG-KT','Katsina'),('NG-KT-BAT','Batagarawa','NG-KT','Katsina'),
('NG-KT-BTS','Batsari','NG-KT','Katsina'),('NG-KT-BAU','Baure','NG-KT','Katsina'),
('NG-KT-BIN','Bindawa','NG-KT','Katsina'),('NG-KT-CHA','Charanchi','NG-KT','Katsina'),
('NG-KT-DAN','Dan Musa','NG-KT','Katsina'),('NG-KT-DND','Dandume','NG-KT','Katsina'),
('NG-KT-DNJ','Danja','NG-KT','Katsina'),('NG-KT-DAU','Daura','NG-KT','Katsina'),
('NG-KT-DUT','Dutsi','NG-KT','Katsina'),('NG-KT-DTM','Dutsin Ma','NG-KT','Katsina'),
('NG-KT-FAS','Faskari','NG-KT','Katsina'),('NG-KT-FUN','Funtua','NG-KT','Katsina'),
('NG-KT-ING','Ingawa','NG-KT','Katsina'),('NG-KT-JIB','Jibia','NG-KT','Katsina'),
('NG-KT-KAF','Kafur','NG-KT','Katsina'),('NG-KT-KAI','Kaita','NG-KT','Katsina'),
('NG-KT-KNK','Kankara','NG-KT','Katsina'),('NG-KT-KNI','Kankia','NG-KT','Katsina'),
('NG-KT-KTS','Katsina','NG-KT','Katsina'),('NG-KT-KUR','Kurfi','NG-KT','Katsina'),
('NG-KT-KUS','Kusada','NG-KT','Katsina'),('NG-KT-MAI','Mai''adua','NG-KT','Katsina'),
('NG-KT-MAL','Malumfashi','NG-KT','Katsina'),('NG-KT-MAN','Mani','NG-KT','Katsina'),
('NG-KT-MAS','Mashi','NG-KT','Katsina'),('NG-KT-MAT','Matazu','NG-KT','Katsina'),
('NG-KT-MUS','Musawa','NG-KT','Katsina'),('NG-KT-RIM','Rimi','NG-KT','Katsina'),
('NG-KT-SAB','Sabuwa','NG-KT','Katsina'),('NG-KT-SAF','Safana','NG-KT','Katsina'),
('NG-KT-SAN','Sandamu','NG-KT','Katsina'),('NG-KT-ZAN','Zango','NG-KT','Katsina'),
-- KEBBI (21)
('NG-KE-ALE','Aleiro','NG-KE','Kebbi'),('NG-KE-ARD','Arewa Dandi','NG-KE','Kebbi'),
('NG-KE-ARG','Argungu','NG-KE','Kebbi'),('NG-KE-AUG','Augie','NG-KE','Kebbi'),
('NG-KE-BAG','Bagudo','NG-KE','Kebbi'),('NG-KE-BKB','Birnin Kebbi','NG-KE','Kebbi'),
('NG-KE-BUN','Bunza','NG-KE','Kebbi'),('NG-KE-DAN','Dandi','NG-KE','Kebbi'),
('NG-KE-FAK','Fakai','NG-KE','Kebbi'),('NG-KE-GWA','Gwandu','NG-KE','Kebbi'),
('NG-KE-JEG','Jega','NG-KE','Kebbi'),('NG-KE-KAL','Kalgo','NG-KE','Kebbi'),
('NG-KE-KOK','Koko/Besse','NG-KE','Kebbi'),('NG-KE-MAI','Maiyama','NG-KE','Kebbi'),
('NG-KE-NGA','Ngaski','NG-KE','Kebbi'),('NG-KE-SAK','Sakaba','NG-KE','Kebbi'),
('NG-KE-SHA','Shanga','NG-KE','Kebbi'),('NG-KE-SUR','Suru','NG-KE','Kebbi'),
('NG-KE-WAS','Wasagu/Danko','NG-KE','Kebbi'),('NG-KE-YAU','Yauri','NG-KE','Kebbi'),
('NG-KE-ZUR','Zuru','NG-KE','Kebbi'),
-- KOGI (21)
('NG-KO-ADA','Adavi','NG-KO','Kogi'),('NG-KO-AJA','Ajaokuta','NG-KO','Kogi'),
('NG-KO-ANK','Ankpa','NG-KO','Kogi'),('NG-KO-BAS','Bassa','NG-KO','Kogi'),
('NG-KO-DEK','Dekina','NG-KO','Kogi'),('NG-KO-IBA','Ibaji','NG-KO','Kogi'),
('NG-KO-IDA','Idah','NG-KO','Kogi'),('NG-KO-IGA','Igalamela Odolu','NG-KO','Kogi'),
('NG-KO-IJU','Ijumu','NG-KO','Kogi'),('NG-KO-KAB','Kabba/Bunu','NG-KO','Kogi'),
('NG-KO-KOG','Kogi','NG-KO','Kogi'),('NG-KO-LOK','Lokoja','NG-KO','Kogi'),
('NG-KO-MOP','Mopa Muro','NG-KO','Kogi'),('NG-KO-OFU','Ofu','NG-KO','Kogi'),
('NG-KO-OGM','Ogori/Magongo','NG-KO','Kogi'),('NG-KO-OKE','Okehi','NG-KO','Kogi'),
('NG-KO-OKN','Okene','NG-KO','Kogi'),('NG-KO-OLA','Olamaboro','NG-KO','Kogi'),
('NG-KO-OMA','Omala','NG-KO','Kogi'),('NG-KO-YGE','Yagba East','NG-KO','Kogi'),
('NG-KO-YGW','Yagba West','NG-KO','Kogi'),
-- KWARA (16)
('NG-KW-ASA','Asa','NG-KW','Kwara'),('NG-KW-BAR','Baruten','NG-KW','Kwara'),
('NG-KW-EDU','Edu','NG-KW','Kwara'),('NG-KW-EKI','Ekiti','NG-KW','Kwara'),
('NG-KW-IFE','Ifelodun','NG-KW','Kwara'),('NG-KW-ILE','Ilorin East','NG-KW','Kwara'),
('NG-KW-ILS','Ilorin South','NG-KW','Kwara'),('NG-KW-ILW','Ilorin West','NG-KW','Kwara'),
('NG-KW-IRE','Irepodun','NG-KW','Kwara'),('NG-KW-ISI','Isin','NG-KW','Kwara'),
('NG-KW-KAI','Kaiama','NG-KW','Kwara'),('NG-KW-MOR','Moro','NG-KW','Kwara'),
('NG-KW-OFF','Offa','NG-KW','Kwara'),('NG-KW-OKE','Oke Ero','NG-KW','Kwara'),
('NG-KW-OYU','Oyun','NG-KW','Kwara'),('NG-KW-PAT','Pategi','NG-KW','Kwara'),
-- LAGOS (20)
('NG-LA-AGE','Agege','NG-LA','Lagos'),('NG-LA-AJI','Ajeromi-Ifelodun','NG-LA','Lagos'),
('NG-LA-ALI','Alimosho','NG-LA','Lagos'),('NG-LA-AMU','Amuwo-Odofin','NG-LA','Lagos'),
('NG-LA-APA','Apapa','NG-LA','Lagos'),('NG-LA-BAD','Badagry','NG-LA','Lagos'),
('NG-LA-EPE','Epe','NG-LA','Lagos'),('NG-LA-ETI','Eti Osa','NG-LA','Lagos'),
('NG-LA-IBL','Ibeju-Lekki','NG-LA','Lagos'),('NG-LA-IFA','Ifako-Ijaye','NG-LA','Lagos'),
('NG-LA-IKE','Ikeja','NG-LA','Lagos'),('NG-LA-IKO','Ikorodu','NG-LA','Lagos'),
('NG-LA-KOS','Kosofe','NG-LA','Lagos'),('NG-LA-LGI','Lagos Island','NG-LA','Lagos'),
('NG-LA-LGM','Lagos Mainland','NG-LA','Lagos'),('NG-LA-MUS','Mushin','NG-LA','Lagos'),
('NG-LA-OJO','Ojo','NG-LA','Lagos'),('NG-LA-OSH','Oshodi-Isolo','NG-LA','Lagos'),
('NG-LA-SHO','Shomolu','NG-LA','Lagos'),('NG-LA-SUR','Surulere','NG-LA','Lagos'),
-- NASARAWA (13)
('NG-NA-AKW','Akwanga','NG-NA','Nasarawa'),('NG-NA-AWE','Awe','NG-NA','Nasarawa'),
('NG-NA-DOM','Doma','NG-NA','Nasarawa'),('NG-NA-KAR','Karu','NG-NA','Nasarawa'),
('NG-NA-KEA','Keana','NG-NA','Nasarawa'),('NG-NA-KEF','Keffi','NG-NA','Nasarawa'),
('NG-NA-KOK','Kokona','NG-NA','Nasarawa'),('NG-NA-LAF','Lafia','NG-NA','Nasarawa'),
('NG-NA-NAS','Nasarawa','NG-NA','Nasarawa'),('NG-NA-NEG','Nasarawa Egon','NG-NA','Nasarawa'),
('NG-NA-OBI','Obi','NG-NA','Nasarawa'),('NG-NA-TOT','Toto','NG-NA','Nasarawa'),
('NG-NA-WAM','Wamba','NG-NA','Nasarawa'),
-- NIGER (25)
('NG-NI-AGA','Agaie','NG-NI','Niger'),('NG-NI-AGW','Agwara','NG-NI','Niger'),
('NG-NI-BID','Bida','NG-NI','Niger'),('NG-NI-BOR','Borgu','NG-NI','Niger'),
('NG-NI-BOS','Bosso','NG-NI','Niger'),('NG-NI-CHA','Chanchaga','NG-NI','Niger'),
('NG-NI-EDA','Edati','NG-NI','Niger'),('NG-NI-GBA','Gbako','NG-NI','Niger'),
('NG-NI-GUR','Gurara','NG-NI','Niger'),('NG-NI-KAT','Katcha','NG-NI','Niger'),
('NG-NI-KON','Kontagora','NG-NI','Niger'),('NG-NI-LAP','Lapai','NG-NI','Niger'),
('NG-NI-LAV','Lavun','NG-NI','Niger'),('NG-NI-MAG','Magama','NG-NI','Niger'),
('NG-NI-MAR','Mariga','NG-NI','Niger'),('NG-NI-MAS','Mashegu','NG-NI','Niger'),
('NG-NI-MOK','Mokwa','NG-NI','Niger'),('NG-NI-MUN','Munya','NG-NI','Niger'),
('NG-NI-PAI','Paikoro','NG-NI','Niger'),('NG-NI-RAF','Rafi','NG-NI','Niger'),
('NG-NI-RIJ','Rijau','NG-NI','Niger'),('NG-NI-SHI','Shiroro','NG-NI','Niger'),
('NG-NI-SUL','Suleja','NG-NI','Niger'),('NG-NI-TAF','Tafa','NG-NI','Niger'),
('NG-NI-WUS','Wushishi','NG-NI','Niger'),
-- OGUN (20)
('NG-OG-ABN','Abeokuta North','NG-OG','Ogun'),('NG-OG-ABS','Abeokuta South','NG-OG','Ogun'),
('NG-OG-ADO','Ado-Odo/Ota','NG-OG','Ogun'),('NG-OG-EGN','Egbado North','NG-OG','Ogun'),
('NG-OG-EGS','Egbado South','NG-OG','Ogun'),('NG-OG-EWE','Ewekoro','NG-OG','Ogun'),
('NG-OG-IFO','Ifo','NG-OG','Ogun'),('NG-OG-IJE','Ijebu East','NG-OG','Ogun'),
('NG-OG-IJN','Ijebu North','NG-OG','Ogun'),('NG-OG-IJX','Ijebu North East','NG-OG','Ogun'),
('NG-OG-IJO','Ijebu Ode','NG-OG','Ogun'),('NG-OG-IKE','Ikenne','NG-OG','Ogun'),
('NG-OG-IME','Imeko Afon','NG-OG','Ogun'),('NG-OG-IPO','Ipokia','NG-OG','Ogun'),
('NG-OG-OBA','Obafemi Owode','NG-OG','Ogun'),('NG-OG-ODE','Odeda','NG-OG','Ogun'),
('NG-OG-ODG','Odogbolu','NG-OG','Ogun'),('NG-OG-OGW','Ogun Waterside','NG-OG','Ogun'),
('NG-OG-REM','Remo North','NG-OG','Ogun'),('NG-OG-SHA','Shagamu','NG-OG','Ogun'),
-- ONDO (18)
('NG-ON-AKE','Akoko North East','NG-ON','Ondo'),('NG-ON-AKW','Akoko North West','NG-ON','Ondo'),
('NG-ON-AKS','Akoko South East','NG-ON','Ondo'),('NG-ON-AKX','Akoko South West','NG-ON','Ondo'),
('NG-ON-AKN','Akure North','NG-ON','Ondo'),('NG-ON-AKR','Akure South','NG-ON','Ondo'),
('NG-ON-ESO','Ese Odo','NG-ON','Ondo'),('NG-ON-IDA','Idanre','NG-ON','Ondo'),
('NG-ON-IFE','Ifedore','NG-ON','Ondo'),('NG-ON-ILA','Ilaje','NG-ON','Ondo'),
('NG-ON-ILO','Ile Oluji/Okeigbo','NG-ON','Ondo'),('NG-ON-IRE','Irele','NG-ON','Ondo'),
('NG-ON-ODI','Odigbo','NG-ON','Ondo'),('NG-ON-OKI','Okitipupa','NG-ON','Ondo'),
('NG-ON-ONE','Ondo East','NG-ON','Ondo'),('NG-ON-ONW','Ondo West','NG-ON','Ondo'),
('NG-ON-OSE','Ose','NG-ON','Ondo'),('NG-ON-OWO','Owo','NG-ON','Ondo'),
-- OSUN (30)
('NG-OS-ATE','Atakumosa East','NG-OS','Osun'),('NG-OS-ATW','Atakumosa West','NG-OS','Osun'),
('NG-OS-AYE','Ayedaade','NG-OS','Osun'),('NG-OS-AYD','Ayedire','NG-OS','Osun'),
('NG-OS-BOL','Boluwaduro','NG-OS','Osun'),('NG-OS-BOR','Boripe','NG-OS','Osun'),
('NG-OS-EDN','Ede North','NG-OS','Osun'),('NG-OS-EDS','Ede South','NG-OS','Osun'),
('NG-OS-EGB','Egbedore','NG-OS','Osun'),('NG-OS-EJI','Ejigbo','NG-OS','Osun'),
('NG-OS-IFC','Ife Central','NG-OS','Osun'),('NG-OS-IFE','Ife East','NG-OS','Osun'),
('NG-OS-IFN','Ife North','NG-OS','Osun'),('NG-OS-IFS','Ife South','NG-OS','Osun'),
('NG-OS-IFD','Ifedayo','NG-OS','Osun'),('NG-OS-IFL','Ifelodun','NG-OS','Osun'),
('NG-OS-ILA','Ila','NG-OS','Osun'),('NG-OS-ILE','Ilesa East','NG-OS','Osun'),
('NG-OS-ILW','Ilesa West','NG-OS','Osun'),('NG-OS-IRE','Irepodun','NG-OS','Osun'),
('NG-OS-IRW','Irewole','NG-OS','Osun'),('NG-OS-ISO','Isokan','NG-OS','Osun'),
('NG-OS-IWO','Iwo','NG-OS','Osun'),('NG-OS-OBO','Obokun','NG-OS','Osun'),
('NG-OS-ODO','Odo Otin','NG-OS','Osun'),('NG-OS-OLA','Ola Oluwa','NG-OS','Osun'),
('NG-OS-OLO','Olorunda','NG-OS','Osun'),('NG-OS-ORI','Oriade','NG-OS','Osun'),
('NG-OS-ORL','Orolu','NG-OS','Osun'),('NG-OS-OSO','Osogbo','NG-OS','Osun'),
-- OYO (33)
('NG-OY-AFI','Afijio','NG-OY','Oyo'),('NG-OY-AKI','Akinyele','NG-OY','Oyo'),
('NG-OY-ATI','Atiba','NG-OY','Oyo'),('NG-OY-ATS','Atisbo','NG-OY','Oyo'),
('NG-OY-EGB','Egbeda','NG-OY','Oyo'),('NG-OY-IBN','Ibadan North','NG-OY','Oyo'),
('NG-OY-IBE','Ibadan North East','NG-OY','Oyo'),('NG-OY-IBW','Ibadan North West','NG-OY','Oyo'),
('NG-OY-IBS','Ibadan South East','NG-OY','Oyo'),('NG-OY-IBX','Ibadan South West','NG-OY','Oyo'),
('NG-OY-IBC','Ibarapa Central','NG-OY','Oyo'),('NG-OY-IBP','Ibarapa East','NG-OY','Oyo'),
('NG-OY-IBQ','Ibarapa North','NG-OY','Oyo'),('NG-OY-IDO','Ido','NG-OY','Oyo'),
('NG-OY-IRE','Irepo','NG-OY','Oyo'),('NG-OY-ISE','Iseyin','NG-OY','Oyo'),
('NG-OY-ITE','Itesiwaju','NG-OY','Oyo'),('NG-OY-IWA','Iwajowa','NG-OY','Oyo'),
('NG-OY-KAJ','Kajola','NG-OY','Oyo'),('NG-OY-LAG','Lagelu','NG-OY','Oyo'),
('NG-OY-OGN','Ogbomosho North','NG-OY','Oyo'),('NG-OY-OGS','Ogbomosho South','NG-OY','Oyo'),
('NG-OY-OGO','Ogo Oluwa','NG-OY','Oyo'),('NG-OY-OLO','Olorunsogo','NG-OY','Oyo'),
('NG-OY-OLY','Oluyole','NG-OY','Oyo'),('NG-OY-ONA','Ona Ara','NG-OY','Oyo'),
('NG-OY-ORE','Orelope','NG-OY','Oyo'),('NG-OY-ORI','Orire','NG-OY','Oyo'),
('NG-OY-OYE','Oyo East','NG-OY','Oyo'),('NG-OY-OYW','Oyo West','NG-OY','Oyo'),
('NG-OY-SKE','Saki East','NG-OY','Oyo'),('NG-OY-SKW','Saki West','NG-OY','Oyo'),
('NG-OY-SUR','Surulere','NG-OY','Oyo'),
-- PLATEAU (17)
('NG-PL-BAR','Barkin Ladi','NG-PL','Plateau'),('NG-PL-BAS','Bassa','NG-PL','Plateau'),
('NG-PL-BOK','Bokkos','NG-PL','Plateau'),('NG-PL-JOE','Jos East','NG-PL','Plateau'),
('NG-PL-JON','Jos North','NG-PL','Plateau'),('NG-PL-JOS','Jos South','NG-PL','Plateau'),
('NG-PL-KAN','Kanam','NG-PL','Plateau'),('NG-PL-KNK','Kanke','NG-PL','Plateau'),
('NG-PL-LGN','Langtang North','NG-PL','Plateau'),('NG-PL-LGS','Langtang South','NG-PL','Plateau'),
('NG-PL-MAN','Mangu','NG-PL','Plateau'),('NG-PL-MIK','Mikang','NG-PL','Plateau'),
('NG-PL-PAN','Pankshin','NG-PL','Plateau'),('NG-PL-QUA','Qua''an Pan','NG-PL','Plateau'),
('NG-PL-RIY','Riyom','NG-PL','Plateau'),('NG-PL-SHE','Shendam','NG-PL','Plateau'),
('NG-PL-WAS','Wase','NG-PL','Plateau'),
-- RIVERS (23)
('NG-RI-ABU','Abua/Odual','NG-RI','Rivers'),('NG-RI-AHE','Ahoada East','NG-RI','Rivers'),
('NG-RI-AHW','Ahoada West','NG-RI','Rivers'),('NG-RI-AKU','Akuku Toru','NG-RI','Rivers'),
('NG-RI-AND','Andoni','NG-RI','Rivers'),('NG-RI-ASA','Asari-Toru','NG-RI','Rivers'),
('NG-RI-BON','Bonny','NG-RI','Rivers'),('NG-RI-DEG','Degema','NG-RI','Rivers'),
('NG-RI-ELE','Eleme','NG-RI','Rivers'),('NG-RI-EMU','Emuoha','NG-RI','Rivers'),
('NG-RI-ETC','Etche','NG-RI','Rivers'),('NG-RI-GOK','Gokana','NG-RI','Rivers'),
('NG-RI-IKW','Ikwerre','NG-RI','Rivers'),('NG-RI-KHA','Khana','NG-RI','Rivers'),
('NG-RI-OBI','Obio/Akpor','NG-RI','Rivers'),('NG-RI-OGE','Ogba/Egbema/Ndoni','NG-RI','Rivers'),
('NG-RI-OGU','Ogu/Bolo','NG-RI','Rivers'),('NG-RI-OKR','Okrika','NG-RI','Rivers'),
('NG-RI-OMU','Omuma','NG-RI','Rivers'),('NG-RI-OPO','Opobo/Nkoro','NG-RI','Rivers'),
('NG-RI-OYI','Oyigbo','NG-RI','Rivers'),('NG-RI-PHC','Port Harcourt','NG-RI','Rivers'),
('NG-RI-TAI','Tai','NG-RI','Rivers'),
-- SOKOTO (23)
('NG-SO-BIN','Binji','NG-SO','Sokoto'),('NG-SO-BOD','Bodinga','NG-SO','Sokoto'),
('NG-SO-DAN','Dange Shuni','NG-SO','Sokoto'),('NG-SO-GAD','Gada','NG-SO','Sokoto'),
('NG-SO-GOR','Goronyo','NG-SO','Sokoto'),('NG-SO-GUD','Gudu','NG-SO','Sokoto'),
('NG-SO-GWD','Gwadabawa','NG-SO','Sokoto'),('NG-SO-ILL','Illela','NG-SO','Sokoto'),
('NG-SO-ISA','Isa','NG-SO','Sokoto'),('NG-SO-KEB','Kebbe','NG-SO','Sokoto'),
('NG-SO-KWA','Kware','NG-SO','Sokoto'),('NG-SO-RAB','Rabah','NG-SO','Sokoto'),
('NG-SO-SAB','Sabon Birni','NG-SO','Sokoto'),('NG-SO-SHA','Shagari','NG-SO','Sokoto'),
('NG-SO-SIL','Silame','NG-SO','Sokoto'),('NG-SO-SKN','Sokoto North','NG-SO','Sokoto'),
('NG-SO-SKS','Sokoto South','NG-SO','Sokoto'),('NG-SO-TAM','Tambuwal','NG-SO','Sokoto'),
('NG-SO-TAN','Tangaza','NG-SO','Sokoto'),('NG-SO-TUR','Tureta','NG-SO','Sokoto'),
('NG-SO-WAM','Wamako','NG-SO','Sokoto'),('NG-SO-WUR','Wurno','NG-SO','Sokoto'),
('NG-SO-YAB','Yabo','NG-SO','Sokoto'),
-- TARABA (16)
('NG-TA-ARD','Ardo Kola','NG-TA','Taraba'),('NG-TA-BAL','Bali','NG-TA','Taraba'),
('NG-TA-DON','Donga','NG-TA','Taraba'),('NG-TA-GAS','Gashaka','NG-TA','Taraba'),
('NG-TA-GSL','Gassol','NG-TA','Taraba'),('NG-TA-IBI','Ibi','NG-TA','Taraba'),
('NG-TA-JAL','Jalingo','NG-TA','Taraba'),('NG-TA-KAR','Karim Lamido','NG-TA','Taraba'),
('NG-TA-KUM','Kumi','NG-TA','Taraba'),('NG-TA-LAU','Lau','NG-TA','Taraba'),
('NG-TA-SAR','Sardauna','NG-TA','Taraba'),('NG-TA-TAK','Takum','NG-TA','Taraba'),
('NG-TA-USS','Ussa','NG-TA','Taraba'),('NG-TA-WUK','Wukari','NG-TA','Taraba'),
('NG-TA-YOR','Yorro','NG-TA','Taraba'),('NG-TA-ZIN','Zing','NG-TA','Taraba'),
-- YOBE (17)
('NG-YO-BAD','Bade','NG-YO','Yobe'),('NG-YO-BUR','Bursari','NG-YO','Yobe'),
('NG-YO-DAM','Damaturu','NG-YO','Yobe'),('NG-YO-FIK','Fika','NG-YO','Yobe'),
('NG-YO-FUN','Fune','NG-YO','Yobe'),('NG-YO-GEI','Geidam','NG-YO','Yobe'),
('NG-YO-GUJ','Gujba','NG-YO','Yobe'),('NG-YO-GUL','Gulani','NG-YO','Yobe'),
('NG-YO-JAK','Jakusko','NG-YO','Yobe'),('NG-YO-KAR','Karasuwa','NG-YO','Yobe'),
('NG-YO-MAC','Machina','NG-YO','Yobe'),('NG-YO-NAN','Nangere','NG-YO','Yobe'),
('NG-YO-NGU','Nguru','NG-YO','Yobe'),('NG-YO-POT','Potiskum','NG-YO','Yobe'),
('NG-YO-TAR','Tarmuwa','NG-YO','Yobe'),('NG-YO-YUN','Yunusari','NG-YO','Yobe'),
('NG-YO-YUS','Yusufari','NG-YO','Yobe'),
-- ZAMFARA (14)
('NG-ZA-ANK','Anka','NG-ZA','Zamfara'),('NG-ZA-BAK','Bakura','NG-ZA','Zamfara'),
('NG-ZA-BMK','Birnin Magaji/Kiyaw','NG-ZA','Zamfara'),('NG-ZA-BUK','Bukkuyum','NG-ZA','Zamfara'),
('NG-ZA-BUN','Bungudu','NG-ZA','Zamfara'),('NG-ZA-GUM','Gummi','NG-ZA','Zamfara'),
('NG-ZA-GUS','Gusau','NG-ZA','Zamfara'),('NG-ZA-KAU','Kaura Namoda','NG-ZA','Zamfara'),
('NG-ZA-MAR','Maradun','NG-ZA','Zamfara'),('NG-ZA-MAU','Maru','NG-ZA','Zamfara'),
('NG-ZA-SHI','Shinkafi','NG-ZA','Zamfara'),('NG-ZA-TAL','Talata Mafara','NG-ZA','Zamfara'),
('NG-ZA-TSA','Tsafe','NG-ZA','Zamfara'),('NG-ZA-ZUR','Zurmi','NG-ZA','Zamfara'),
-- FCT ABUJA (6)
('NG-FC-ABJ','Abaji','NG-FC','FCT Abuja'),('NG-FC-BWR','Bwari','NG-FC','FCT Abuja'),
('NG-FC-GWA','Gwagwalada','NG-FC','FCT Abuja'),('NG-FC-KUJ','Kuje','NG-FC','FCT Abuja'),
('NG-FC-KWL','Kwali','NG-FC','FCT Abuja'),('NG-FC-MAC','Municipal Area Council','NG-FC','FCT Abuja')

ON CONFLICT (lga_code) DO NOTHING;


-- ────────────────────────────────────────────────────────────────────────────
-- 015: Custom table builder
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_series (
  id             BIGSERIAL PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  description    TEXT,
  what_is        TEXT,
  how_to_read    TEXT,
  why_it_matters TEXT,
  geo_resolution TEXT NOT NULL DEFAULT 'national'
    CHECK (geo_resolution IN ('national','state','lga')),
  is_public      BOOLEAN NOT NULL DEFAULT true,
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_columns (
  id            BIGSERIAL PRIMARY KEY,
  series_id     BIGINT NOT NULL REFERENCES custom_series(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  column_type   TEXT NOT NULL DEFAULT 'text'
    CHECK (column_type IN ('text','numeric','date','select','cbn_rate','lga_ref','state_ref')),
  unit          TEXT,
  is_required   BOOLEAN NOT NULL DEFAULT true,
  is_readonly   BOOLEAN NOT NULL DEFAULT false,
  config        JSONB,
  display_order INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, slug)
);

CREATE TABLE IF NOT EXISTS custom_records (
  id                BIGSERIAL PRIMARY KEY,
  series_id         BIGINT NOT NULL REFERENCES custom_series(id) ON DELETE CASCADE,
  period_date       DATE NOT NULL,
  region            TEXT DEFAULT 'NGA',
  lga_id            BIGINT REFERENCES lgas(id),
  data              JSONB NOT NULL,
  upload_session_id BIGINT,
  created_by        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_records_series  ON custom_records(series_id);
CREATE INDEX IF NOT EXISTS idx_custom_records_period  ON custom_records(series_id, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_custom_records_lga     ON custom_records(lga_id) WHERE lga_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_custom_records_data    ON custom_records USING GIN(data);

ALTER TABLE custom_series  ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_custom_series"   ON custom_series  FOR SELECT USING (is_public = true);
CREATE POLICY "service_role_custom_series"  ON custom_series  USING (true) WITH CHECK (true);
CREATE POLICY "public_read_custom_columns"  ON custom_columns FOR SELECT
  USING (EXISTS (SELECT 1 FROM custom_series s WHERE s.id = custom_columns.series_id AND s.is_public = true));
CREATE POLICY "service_role_custom_columns" ON custom_columns USING (true) WITH CHECK (true);
CREATE POLICY "public_read_custom_records"  ON custom_records FOR SELECT
  USING (EXISTS (SELECT 1 FROM custom_series s WHERE s.id = custom_records.series_id AND s.is_public = true));
CREATE POLICY "service_role_custom_records" ON custom_records USING (true) WITH CHECK (true);

-- Seed: CRUDE PRODUCTION SALES
INSERT INTO custom_series (slug, name, description, what_is, how_to_read, why_it_matters, geo_resolution, is_public, created_by)
VALUES (
  'crude_production_sale',
  'CRUDE PRODUCTION SALES',
  'Records of crude oil sales transactions — buyer, volume in barrels, exchange rate at point of sale, and live CBN rate at time of entry.',
  'Each record represents a single crude oil sale transaction, capturing the buyer, the volume lifted in barrels, the USD rate agreed at point of sale, and the CBN official rate automatically recorded at the time of data entry.',
  'Compare the USD rate at sale against the CBN rate to understand the premium or discount at which each transaction was executed. Higher barrels with a favourable rate indicates strong revenue performance.',
  'Crude sales are the primary source of Nigeria''s foreign exchange earnings. Tracking each transaction with its exchange rate provides an auditable record of how oil revenue translates into naira at different points in time.',
  'national', true, 'system'
);

INSERT INTO custom_columns (series_id, name, slug, column_type, unit, is_required, is_readonly, config, display_order)
SELECT s.id, col.name, col.slug, col.column_type, col.unit, col.is_required, col.is_readonly, col.config::jsonb, col.display_order
FROM custom_series s
CROSS JOIN (VALUES
  ('Date of Sale',              'date',             'date',     NULL,       true,  false, '{"format":"YYYY-MM-DD"}',  1),
  ('Buyer / Recipient',         'buyer',            'text',     NULL,       true,  false, NULL,                        2),
  ('Volume (Barrels)',          'barrels',          'numeric',  'barrels',  true,  false, '{"min":0,"decimals":0}',    3),
  ('USD Rate at Point of Sale', 'usd_rate_at_sale', 'numeric',  'USD/NGN',  true,  false, '{"min":0,"decimals":4}',    4),
  ('CBN Rate (Auto)',           'cbn_rate',         'cbn_rate', 'USD/NGN',  true,  true,  NULL,                        5)
) AS col(name, slug, column_type, unit, is_required, is_readonly, config, display_order)
WHERE s.slug = 'crude_production_sale';
