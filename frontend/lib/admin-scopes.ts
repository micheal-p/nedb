// ── lib/admin-scopes.ts ─────────────────────────────────────────────────────
// The seven administrations. Roles decide WHAT an account may do; the scope
// decides WHERE an administrator works. A superadmin is the software admin
// and sees everything; an admin with no scope keeps the full legacy rail.

export type AdminScope =
  | "software" | "business" | "technical" | "research"
  | "data_entry" | "accounting" | "audit";

export const ADMIN_SCOPES: { value: AdminScope; label: string; blurb: string }[] = [
  { value: "software",   label: "Software Administration",   blurb: "The whole platform — the superadmin's own scope" },
  { value: "business",   label: "Business Administration",   blurb: "Outreach, publications, dashboards, finance" },
  { value: "technical",  label: "Technical Administration",  blurb: "Platform health, data plumbing, intelligence" },
  { value: "research",   label: "Research & Editorial",      blurb: "Assessments, working papers, bulletins" },
  { value: "data_entry", label: "Data Entry",                blurb: "Records, terminal, uploads" },
  { value: "accounting", label: "Accounting",                blurb: "Orders, quotes, payments" },
  { value: "audit",      label: "Auditing",                  blurb: "The audit log — usually time-boxed" },
];

/** Which scopes see which rail group. The group names must match ADMIN_NAV. */
export const GROUP_SCOPES: Record<string, AdminScope[]> = {
  "Data & Records": ["software", "technical", "data_entry"],
  "Assessments":    ["software", "research", "data_entry", "business"],
  "Dashboards":     ["software", "business", "technical"],
  "Publications":   ["software", "research", "business"],
  "Intelligence":   ["software", "technical", "research"],
  "Governance":     ["software", "technical", "audit"],
  "Finance":        ["software", "business", "accounting"],
  "Outreach":       ["software", "business"],
};

/** May this admin see this rail group? Superadmins and unscoped admins see all. */
export function scopeAllowsGroup(role: string, scope: string | null | undefined, group: string): boolean {
  if (role === "superadmin") return true;
  if (!scope) return true;   // legacy admin: full rail until a scope is set
  return (GROUP_SCOPES[group] ?? []).includes(scope as AdminScope);
}

/** Server-side check for scoped APIs. */
export function hasScope(role: string | undefined, scope: string | null | undefined, ...wanted: AdminScope[]): boolean {
  if (role === "superadmin") return true;
  if (role !== "admin") return false;
  if (!scope) return true;   // legacy admin
  return wanted.includes(scope as AdminScope);
}
