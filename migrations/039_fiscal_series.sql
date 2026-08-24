-- ── 039: Fiscal series — real taxation and revenue series in the registry ──
-- Adds the fiscal indicator set the Revenue views promise. All figures land
-- through the normal upload → validate → commit flow, provisional until the
-- source agency confirms. FIRS became the Nigeria Revenue Service (NRS) on
-- 1 January 2026 under the NRS (Establishment) Act 2025; the Hydrocarbon Tax
-- replaced Petroleum Profits Tax for PIA-converted leases.

INSERT INTO series_types (id, name, sector, subsector, unit_default, frequency, viz_types, description, methodology, source_agency)
VALUES
  (
    'hydrocarbon_tax',
    'Hydrocarbon Tax Receipts',
    'fiscal', 'upstream_tax',
    '₦ Billion', 'quarterly', '{line,bar}',
    'Hydrocarbon Tax collected from upstream petroleum companies operating under Petroleum Industry Act 2021 fiscal terms. Replaced Petroleum Profits Tax for converted leases.',
    'Cash receipts as reported by the Nigeria Revenue Service (NRS). Quarterly figures represent collections, not assessments. Figures are provisional until reconciled with NRS annual collection reports.',
    'Nigeria Revenue Service (NRS, formerly FIRS)'
  ),
  (
    'cit_energy',
    'CIT from Energy Companies',
    'fiscal', 'company_tax',
    '₦ Billion', 'quarterly', '{line,bar}',
    'Companies Income Tax collected from companies classified in the energy sector: petroleum service companies, power generation and distribution companies, and gas processors.',
    'Sector classification follows the NRS taxpayer registry. Quarterly cash receipts; provisional until reconciled with NRS annual collection reports.',
    'Nigeria Revenue Service (NRS, formerly FIRS)'
  ),
  (
    'gas_flare_penalties',
    'Gas Flaring Penalties',
    'fiscal', 'upstream_levies',
    '₦ Billion', 'quarterly', '{line,bar}',
    'Penalties invoiced to upstream operators for gas flared above permitted thresholds, under the Flare Gas (Prevention of Waste and Pollution) Regulations 2018.',
    'Invoiced amounts by flare site as reported by NUPRC. Payment collections may lag invoicing; figures state the invoiced basis.',
    'NUPRC'
  )
ON CONFLICT (id) DO NOTHING;
