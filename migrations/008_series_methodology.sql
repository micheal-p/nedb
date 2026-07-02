-- ── 008: Add description + methodology notes to series_types ──────────────────

ALTER TABLE series_types
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS methodology  TEXT,
  ADD COLUMN IF NOT EXISTS source_agency TEXT;

-- Seed methodology notes per series
UPDATE series_types SET
  description   = 'Total crude oil lifted from Nigerian fields and terminals, reported monthly by field operators to NUPRC. Covers all onshore, shallow-water, and deepwater production.',
  methodology   = 'Data is collected from individual field production reports (FPRs) submitted by licensed operators under the Petroleum Industry Act 2021. Values represent gross liftings (barrels at well-head) before deductions for Petroleum Profit Tax (PPT) and other deductions. Methodology aligns with the Joint Organisations Data Initiative (JODI) oil questionnaire.',
  source_agency = 'NUPRC (Nigerian Upstream Petroleum Regulatory Commission)'
WHERE id = 'crude_oil_production';

UPDATE series_types SET
  description   = 'Total natural gas produced (associated and non-associated) in Nigeria, including gas flared, re-injected, and utilised. Reported monthly by upstream operators.',
  methodology   = 'Production volumes are measured at metering points at the well-head or gathering stations. Associated gas produced alongside crude oil is allocated by facility. Figures include gross production before deducting gas used in operations. Data sourced from Upstream Gas Production Reports (UGPRs) and cross-checked against NGC nominations.',
  source_agency = 'NUPRC / Nigerian Gas Company (NGC)'
WHERE id = 'natural_gas_production';

UPDATE series_types SET
  description   = 'Volume of Premium Motor Spirit (petrol/PMS) sold through NMDPRA-licensed retail stations and bulk outlets across Nigeria, reported monthly.',
  methodology   = 'Sales volumes are compiled from downstream product movement reports submitted by major marketers, NNPC Limited, and depots to NMDPRA. Data represents ex-depot sales and does not include informal cross-border flows. Unit is million litres.',
  source_agency = 'NMDPRA (Nigerian Midstream & Downstream Petroleum Regulatory Authority)'
WHERE id = 'pms_sales';

UPDATE series_types SET
  description   = 'Volume of Automotive Gas Oil (diesel/AGO) sold through licensed distributors and major consumer sectors (transport, power, industry), reported monthly.',
  methodology   = 'Aggregated from depot offtake reports and major marketer returns to NMDPRA. Includes NNPC wholesale volumes and imports through licensed terminals. Cross-checked against Customs import data quarterly.',
  source_agency = 'NMDPRA'
WHERE id = 'ago_sales';

UPDATE series_types SET
  description   = 'Volume of Dual Purpose Kerosene (DPK/household kerosene) distributed through licensed channels, reported monthly.',
  methodology   = 'Compiled from depot distribution reports. DPK is tracked separately from aviation turbine kerosene (ATK). Significant informality in retail distribution means these figures likely undercount actual consumption.',
  source_agency = 'NMDPRA'
WHERE id = 'kerosine_sales';

UPDATE series_types SET
  description   = 'Volume of Liquefied Petroleum Gas (cooking gas/LPG) sold through licensed cylinders and bulk outlets, reported monthly.',
  methodology   = 'Data consolidated from LPG filling plant reports and major distributor returns. Excludes residential self-imports (small cylinders brought through land borders). Reported in metric tonnes (MT).',
  source_agency = 'NMDPRA / LPG Marshalling Yards'
WHERE id = 'lpg_sales';

UPDATE series_types SET
  description   = 'Total electricity generated at grid-connected power plants (thermal, hydro, and renewables) in Nigeria, reported monthly. Represents gross generation at the busbar.',
  methodology   = 'Generation data is collected from generating companies (GenCos) and the Transmission Company of Nigeria (TCN) via the Market Management System (MMS). Figures are gross generation at plant terminals, before deducting own-use (auxiliary consumption) and transmission losses. Methodology follows the IEA/IRENA Renewable Energy Statistics guidelines.',
  source_agency = 'TCN / NERC (Nigerian Electricity Regulatory Commission)'
WHERE id = 'electricity_generation';

UPDATE series_types SET
  description   = 'Total electricity delivered from generating plants to the transmission network (gross generation minus auxiliary consumption), reported monthly.',
  methodology   = 'Sent-out energy is metered at the high-voltage busbar at each generating plant. The difference between generation and sent-out is auxiliary/station service consumption. TCN aggregates metered data from all grid-connected plants monthly.',
  source_agency = 'TCN / NERC'
WHERE id = 'electricity_sent_out';

UPDATE series_types SET
  description   = 'Electricity consumed by end users across DisCo franchise areas, estimated monthly from metered sales and estimated technical/commercial losses.',
  methodology   = 'Calculated as electricity sent-out minus aggregate technical and commercial (ATC&C) losses. DisCo-level consumption is estimated from customer billing data, metered feeders, and loss factors approved by NERC. National total is the sum of all 11 DisCo franchise areas.',
  source_agency = 'NERC / Distribution Companies (DisCos)'
WHERE id = 'electricity_consumption';

UPDATE series_types SET
  description   = 'Installed renewable energy capacity connected to the national grid or operating as licensed off-grid systems, reported quarterly.',
  methodology   = 'Covers solar PV, wind, small hydro, and bioenergy capacity. Data collected from NERC licensed facilities, REA-supported mini-grid projects, and NBET PPAs. Capacity is nameplate (MW-DC for solar) not derated capacity. Off-grid systems above 100kW are included.',
  source_agency = 'REA (Rural Electrification Agency) / NERC'
WHERE id = 'renewable_energy';

UPDATE series_types SET
  description   = 'Estimated volume of fuelwood (firewood and charcoal) consumed by households and commercial users, reported quarterly by state.',
  methodology   = 'Derived from household energy surveys and Forest Management Unit (FMU) records. Charcoal is converted to wood equivalent using a 6:1 wood-to-charcoal ratio. Significant estimation uncertainty — values should be treated as indicative. Aligned with FAO WISDOM methodology.',
  source_agency = 'ECN / Federal Ministry of Environment'
WHERE id = 'fuelwood_consumption';

UPDATE series_types SET
  description   = 'Federal Government of Nigeria oil and gas revenue shared through the Federation Account Allocation Committee (FAAC), reported quarterly.',
  methodology   = 'FAAC oil revenue includes crude oil sales proceeds, petroleum profit tax, royalties, and signature bonuses accruing to the Federation Account. Data sourced from OAGF/RMAFC monthly FAAC communiqués and reconciled with NNPC remittance reports. Excludes VAT and import duties on petroleum products.',
  source_agency = 'RMAFC / OAGF (Office of the Accountant-General of the Federation)'
WHERE id = 'faac_oil_revenue';

UPDATE series_types SET
  description   = 'Royalties collected from upstream oil and gas producers under the Petroleum Industry Act, reported quarterly. Includes oil royalties, gas royalties, and surface rent.',
  methodology   = 'Royalties are assessed on field-by-field production volumes using statutory rates determined by the Minister of Petroleum Resources under the PIA 2021. NUPRC invoices operators monthly; quarterly figures represent cash receipts (not accruals). Cross-checked against NUPRC field audit reports.',
  source_agency = 'NUPRC / FIRS'
WHERE id = 'upstream_royalties';
