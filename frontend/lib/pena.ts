// ── lib/pena.ts ─────────────────────────────────────────────────────────────
// PENA (Profiling & Energy Needs Assessment) shared logic — usable from both
// API routes (tier computation at submit time) and client components (tier
// colors, labels, default question template).

export type PenaTier = "A" | "B" | "C" | "D" | "E";

// Diverging severity ramp validated against the paper surface (#F8F7F4):
// green arm → neutral midpoint → red arm. Tier letters are ALWAYS rendered
// alongside the color — identity is never color-alone.
export const TIERS: Record<PenaTier, { label: string; color: string; desc: string }> = {
  A: { label: "Energy Secure",      color: "#0E7A3C", desc: "Reliable supply, energy costs a marginal share of income" },
  B: { label: "Energy Stable",      color: "#93BE7E", desc: "Good supply with an affordable energy burden" },
  C: { label: "Energy Constrained", color: "#C9C2B2", desc: "Partial supply or a noticeable energy burden" },
  D: { label: "Energy Poor",        color: "#C97B5F", desc: "Few supply hours or a heavy energy burden" },
  E: { label: "Energy Critical",    color: "#96261A", desc: "Little to no supply and unaffordable energy costs" },
};

export const TIER_ORDER: PenaTier[] = ["A", "B", "C", "D", "E"];

// ── Tier classification ──────────────────────────────────────────────────────
// Deterministic and explainable. Two signals:
//   burden = monthly energy expense ÷ monthly income (share of income on energy)
//   light  = average hours of electricity per day (0–24)
// A–C require BOTH thresholds; D requires either; a response missing income or
// light hours is left unclassified (null) rather than guessed. Thresholds can
// be overridden per form via pena_forms.tier_config (same shape as DEFAULT_TIER_CONFIG).
export type TierConfig = Record<"A" | "B" | "C" | "D", { light: number; burden: number }>;

export const DEFAULT_TIER_CONFIG: TierConfig = {
  A: { light: 20, burden: 0.05 },
  B: { light: 14, burden: 0.10 },
  C: { light: 8,  burden: 0.18 },
  D: { light: 4,  burden: 0.30 },
};

export function computeTier(
  income: number | null,
  lightHours: number | null,
  energyExpense: number | null,
  config?: Partial<TierConfig> | null
): PenaTier | null {
  if (income == null || lightHours == null || !isFinite(income) || !isFinite(lightHours)) return null;
  if (income <= 0) return "E";
  const burden = energyExpense != null && isFinite(energyExpense) ? energyExpense / income : null;
  if (burden == null) return null;

  const c: TierConfig = { ...DEFAULT_TIER_CONFIG, ...(config ?? {}) };
  if (lightHours >= c.A.light && burden <= c.A.burden) return "A";
  if (lightHours >= c.B.light && burden <= c.B.burden) return "B";
  if (lightHours >= c.C.light && burden <= c.C.burden) return "C";
  if (lightHours >= c.D.light || burden <= c.D.burden) return "D";
  return "E";
}

// ── Analytics keys ───────────────────────────────────────────────────────────
// Tie answers to the insight engine no matter how the admin renames a label.
export const ANALYTICS_KEYS = [
  { value: "",               label: "None (free-form)" },
  { value: "full_name",      label: "Respondent name (PII)" },
  { value: "email",          label: "Email — one response each (PII)" },
  { value: "phone",          label: "Phone number (PII)" },
  { value: "income",         label: "Monthly income (₦)" },
  { value: "light_hours",    label: "Avg light hours / day" },
  { value: "energy_expense", label: "Monthly energy expense (₦)" },
  { value: "energy_source",  label: "Primary energy source" },
  { value: "household_size", label: "Household size" },
];

export const QTYPES = [
  { value: "text",        label: "Text" },
  { value: "longtext",    label: "Long text (paragraph)" },
  { value: "number",      label: "Number" },
  { value: "date",        label: "Date" },
  { value: "select",      label: "Select (dropdown)" },
  { value: "multiselect", label: "Checkboxes (multi-select)" },
  { value: "rating",      label: "Rating (1–5)" },
  { value: "phone",       label: "Phone" },
  { value: "email",       label: "Email" },
  { value: "state_ref",   label: "State picker" },
  { value: "lga_ref",     label: "LGA picker" },
  { value: "address",     label: "Address / landmark (geocoded)" },
];

export type PenaQuestionDef = {
  label: string; slug: string; qtype: string; unit: string | null;
  is_required: boolean; is_pii: boolean; analytics_key: string | null;
  config: Record<string, unknown> | null; display_order: number;
};

// Every new form starts from this template — the admin can rename, remove or
// add questions, but the analytics keys keep the insight engine working.
export const DEFAULT_QUESTIONS: PenaQuestionDef[] = [
  { label: "Full Name",                        slug: "full_name",      qtype: "text",      unit: null,        is_required: true,  is_pii: true,  analytics_key: "full_name",      config: null, display_order: 1 },
  { label: "Email Address",                    slug: "email",          qtype: "email",     unit: null,        is_required: true,  is_pii: true,  analytics_key: "email",          config: null, display_order: 2 },
  { label: "Phone Number",                     slug: "phone",          qtype: "phone",     unit: null,        is_required: true,  is_pii: true,  analytics_key: "phone",          config: null, display_order: 3 },
  { label: "State",                            slug: "state",          qtype: "state_ref", unit: null,        is_required: true,  is_pii: false, analytics_key: null,             config: null, display_order: 4 },
  { label: "Local Government Area",            slug: "lga",            qtype: "lga_ref",   unit: null,        is_required: true,  is_pii: false, analytics_key: null,             config: null, display_order: 5 },
  { label: "Address or Nearest Landmark",      slug: "address",        qtype: "address",   unit: null,        is_required: true,  is_pii: true,  analytics_key: null,             config: null, display_order: 6 },
  { label: "Monthly Household Income",         slug: "income",         qtype: "number",    unit: "₦/month",   is_required: true,  is_pii: false, analytics_key: "income",         config: { min: 0 },          display_order: 7 },
  { label: "Average Light Hours Per Day",      slug: "light_hours",    qtype: "number",    unit: "hours/day", is_required: true,  is_pii: false, analytics_key: "light_hours",    config: { min: 0, max: 24 }, display_order: 8 },
  { label: "Monthly Energy Expense",           slug: "energy_expense", qtype: "number",    unit: "₦/month",   is_required: true,  is_pii: false, analytics_key: "energy_expense", config: { min: 0 },          display_order: 9 },
  { label: "Primary Energy Source",            slug: "energy_source",  qtype: "select",    unit: null,        is_required: true,  is_pii: false, analytics_key: "energy_source",  config: { options: ["Grid only", "Grid + Generator", "Generator only", "Solar only", "Solar hybrid", "No electricity"] }, display_order: 10 },
  { label: "Household Size",                   slug: "household_size", qtype: "number",    unit: "people",    is_required: false, is_pii: false, analytics_key: "household_size", config: { min: 1 },          display_order: 11 },
];

export const DEFAULT_CONSENT =
  "I voluntarily provide this information to the Nigeria Energy Data Bank (NEDB) for energy access " +
  "assessment and planning. I understand that my personal details (name, email, phone, address) will be " +
  "kept confidential in line with the Nigeria Data Protection Act 2023 and Section 37 of the Constitution, " +
  "and that only anonymised, aggregated statistics — never my identity or location — may be published as " +
  "open data. I may request removal of my data at any time.";

// k-anonymity floor for public aggregates: any state/LGA group with fewer
// responses than this is suppressed from open-data output.
export const K_ANON_MIN = 5;

// Magic-link verification: a pending response older than this is treated as
// expired (computed at read time — no cron).
export const VERIFY_TTL_HOURS = 48;

export function penaSlugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
