// ── scripts/seed-pena.mjs ───────────────────────────────────────────────────
// Seeds three ready-to-use PENA questionnaires, each angled at a different
// energy-needs question. Idempotent: skips any slug that already exists.
//   node scripts/seed-pena.mjs        (run from frontend/)

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no dotenv dep, per project convention)
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CONSENT =
  "I voluntarily provide this information to the Nigeria Energy Data Bank (NEDB) for energy access " +
  "assessment and planning. I understand that my personal details (name, email, phone, address) will be " +
  "kept confidential in line with the Nigeria Data Protection Act 2023 and Section 37 of the Constitution, " +
  "and that only anonymised, aggregated statistics — never my identity or location — may be published as " +
  "open data. I may request removal of my data at any time.";

// Shared identity + geography block (every questionnaire starts with these)
const IDENTITY = [
  { label: "Full Name",                   slug: "full_name", qtype: "text",      unit: null, is_required: true, is_pii: true,  analytics_key: "full_name", config: null },
  { label: "Email Address",               slug: "email",     qtype: "email",     unit: null, is_required: true, is_pii: true,  analytics_key: "email",     config: null },
  { label: "Phone Number",                slug: "phone",     qtype: "phone",     unit: null, is_required: true, is_pii: true,  analytics_key: "phone",     config: null },
  { label: "State",                       slug: "state",     qtype: "state_ref", unit: null, is_required: true, is_pii: false, analytics_key: null,        config: null },
  { label: "Local Government Area",       slug: "lga",       qtype: "lga_ref",   unit: null, is_required: true, is_pii: false, analytics_key: null,        config: null },
  { label: "Address or Nearest Landmark", slug: "address",   qtype: "address",   unit: null, is_required: true, is_pii: true,  analytics_key: null,        config: null },
];

const FORMS = [
  {
    slug: "household_energy_2026",
    title: "National Household Energy Access Assessment 2026",
    description:
      "Baseline household survey — income, electricity supply hours, energy spending and sources. " +
      "One link for every state; responses are mapped by state and LGA.",
    questions: [
      ...IDENTITY,
      { label: "Monthly Household Income",    slug: "income",         qtype: "number", unit: "₦/month",   is_required: true,  is_pii: false, analytics_key: "income",         config: { min: 0 } },
      { label: "Average Light Hours Per Day", slug: "light_hours",    qtype: "number", unit: "hours/day", is_required: true,  is_pii: false, analytics_key: "light_hours",    config: { min: 0, max: 24 } },
      { label: "Monthly Energy Expense",      slug: "energy_expense", qtype: "number", unit: "₦/month",   is_required: true,  is_pii: false, analytics_key: "energy_expense", config: { min: 0 } },
      { label: "Primary Energy Source",       slug: "energy_source",  qtype: "select", unit: null,        is_required: true,  is_pii: false, analytics_key: "energy_source",  config: { options: ["Grid only", "Grid + Generator", "Generator only", "Solar only", "Solar hybrid", "No electricity"] } },
      { label: "Household Size",              slug: "household_size", qtype: "number", unit: "people",    is_required: false, is_pii: false, analytics_key: "household_size", config: { min: 1 } },
      { label: "Main Cooking Fuel",           slug: "cooking_fuel",   qtype: "select", unit: null,        is_required: true,  is_pii: false, analytics_key: null,             config: { options: ["Firewood", "Charcoal", "Kerosene", "LPG (cooking gas)", "Electricity"] } },
    ],
  },
  {
    slug: "sme_energy_2026",
    title: "SME & Small Business Energy Cost Assessment 2026",
    description:
      "How much unreliable power costs small businesses — generator dependence, total energy spend " +
      "against business income, and the outage impact on operations.",
    questions: [
      { label: "Business Name", slug: "business_name", qtype: "text", unit: null, is_required: true, is_pii: false, analytics_key: null, config: null },
      ...IDENTITY.map((q) => (q.slug === "full_name" ? { ...q, label: "Contact Person (Full Name)" } : q)),
      { label: "Business Type",                              slug: "business_type",  qtype: "select",   unit: null,        is_required: true,  is_pii: false, analytics_key: null,             config: { options: ["Retail shop", "Salon / Barbing", "Welding / Fabrication", "Tailoring / Fashion", "Food / Restaurant", "Cold store / Frozen foods", "Pharmacy", "Office / Services", "Other"] } },
      { label: "Monthly Business Income",                    slug: "income",         qtype: "number",   unit: "₦/month",   is_required: true,  is_pii: false, analytics_key: "income",         config: { min: 0 } },
      { label: "Average Supply Hours Per Working Day",       slug: "light_hours",    qtype: "number",   unit: "hours/day", is_required: true,  is_pii: false, analytics_key: "light_hours",    config: { min: 0, max: 24 } },
      { label: "Total Monthly Energy Spend (grid + fuel)",   slug: "energy_expense", qtype: "number",   unit: "₦/month",   is_required: true,  is_pii: false, analytics_key: "energy_expense", config: { min: 0 } },
      { label: "Backup Power",                               slug: "backup_power",   qtype: "select",   unit: null,        is_required: true,  is_pii: false, analytics_key: "energy_source",  config: { options: ["No backup", "Small petrol generator", "Diesel generator", "Solar + inverter", "Inverter only"] } },
      { label: "How badly do outages affect your business?", slug: "outage_impact",  qtype: "rating",   unit: null,        is_required: true,  is_pii: false, analytics_key: null,             config: null },
      { label: "What would reliable power change for your business?", slug: "reliable_power_change", qtype: "longtext", unit: null, is_required: false, is_pii: false, analytics_key: null, config: null },
    ],
  },
  {
    slug: "community_energy_2026",
    title: "Community Energy Needs & Willingness-to-Pay Survey 2026",
    description:
      "What communities actually power, what they cook with, and what they would pay for reliable " +
      "electricity — sizing demand for solar and mini-grid interventions.",
    questions: [
      ...IDENTITY,
      { label: "Household Size",                            slug: "household_size", qtype: "number",      unit: "people",    is_required: true,  is_pii: false, analytics_key: "household_size", config: { min: 1 } },
      { label: "Monthly Household Income",                  slug: "income",         qtype: "number",      unit: "₦/month",   is_required: true,  is_pii: false, analytics_key: "income",         config: { min: 0 } },
      { label: "Average Light Hours Per Day",               slug: "light_hours",    qtype: "number",      unit: "hours/day", is_required: true,  is_pii: false, analytics_key: "light_hours",    config: { min: 0, max: 24 } },
      { label: "Monthly Energy Expense",                    slug: "energy_expense", qtype: "number",      unit: "₦/month",   is_required: true,  is_pii: false, analytics_key: "energy_expense", config: { min: 0 } },
      { label: "Primary Energy Source",                     slug: "energy_source",  qtype: "select",      unit: null,        is_required: true,  is_pii: false, analytics_key: "energy_source",  config: { options: ["Grid only", "Grid + Generator", "Generator only", "Solar only", "Solar hybrid", "No electricity"] } },
      { label: "Appliances You Power Regularly",            slug: "appliances",     qtype: "multiselect", unit: null,        is_required: true,  is_pii: false, analytics_key: null,             config: { options: ["Bulbs / lighting", "Fan", "TV", "Fridge / Freezer", "Pumping machine", "Air conditioner", "Electric cooker", "Phone charging only"] } },
      { label: "Rate Your Current Electricity Reliability", slug: "reliability",    qtype: "rating",      unit: null,        is_required: true,  is_pii: false, analytics_key: null,             config: null },
      { label: "Would You Pay for Reliable Solar Power?",   slug: "wtp",            qtype: "select",      unit: null,        is_required: true,  is_pii: false, analytics_key: null,             config: { options: ["Yes — monthly plan", "Yes — one-time purchase", "Maybe", "No"] } },
      { label: "How Much Could You Pay Monthly?",           slug: "wtp_amount",     qtype: "number",      unit: "₦/month",   is_required: false, is_pii: false, analytics_key: null,             config: { min: 0 } },
      { label: "Biggest Energy Challenge in Your Community", slug: "challenge",     qtype: "longtext",    unit: null,        is_required: false, is_pii: false, analytics_key: null,             config: null },
    ],
  },
];

for (const f of FORMS) {
  const { data: existing } = await db.from("pena_forms").select("id").eq("slug", f.slug).maybeSingle();
  if (existing) { console.log(`skip  ${f.slug} (already exists)`); continue; }

  const { data: form, error: fe } = await db
    .from("pena_forms")
    .insert({
      slug: f.slug,
      share_token: randomBytes(16).toString("hex"),
      title: f.title,
      description: f.description,
      consent_text: CONSENT,
      status: "open",
      is_public_stats: true,
      created_by: "admin",
    })
    .select("id, share_token")
    .single();
  if (fe) { console.error(`FAIL  ${f.slug}: ${fe.message}`); process.exit(1); }

  const { error: qe } = await db
    .from("pena_questions")
    .insert(f.questions.map((q, i) => ({ ...q, form_id: form.id, display_order: i + 1 })));
  if (qe) { console.error(`FAIL  ${f.slug} questions: ${qe.message}`); process.exit(1); }

  console.log(`seed  ${f.slug}  →  /f/${form.share_token}  (${f.questions.length} questions, OPEN)`);
}
console.log("done");
