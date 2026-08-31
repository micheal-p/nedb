// ── lib/role-scopes.ts ──────────────────────────────────────────────────────
// What each role may and may not do, in one place, written to be shown to the
// people bound by it.
//
// The rules were only ever expressed as guard calls scattered across 78 API
// routes. That is enough to enforce them and not enough for anyone to know
// them: an administrator could not find out what a superadmin holds without
// reading the source, and nobody outside the code could audit the boundary at
// all. Governance that only exists in the implementation is not governance
// anyone can rely on.
//
// This file is descriptive, not enforcing. The guards remain the boundary. If
// the two ever disagree the guards win and THIS FILE IS THE BUG, so it is kept
// deliberately close to them: every line below names a real check.

export type RoleKey = "viewer" | "editor" | "admin" | "superadmin";

export type RoleScope = {
  key: RoleKey;
  label: string;
  /** One line a person could repeat back accurately. */
  summary: string;
  can: string[];
  cannot: string[];
  /** Where the boundary is actually enforced, for anyone checking. */
  enforcedBy: string;
};

export const ROLE_SCOPES: RoleScope[] = [
  {
    key: "viewer",
    label: "Viewer",
    summary: "Reads the dashboards and assessments within their mandate. Changes nothing.",
    can: [
      "Open the dashboard for their assigned profile",
      "See the series inside that profile's sector mandate",
      "Read assessment insights and export what is shown",
      "Read everything already published on the public site",
    ],
    cannot: [
      "Upload, edit or delete any record",
      "Reach the admin console, the upload screen or the data terminal",
      "See series outside their mandate",
      "See identifiable assessment responses unless granted per assessment",
    ],
    enforcedBy: "frontend/proxy.ts page guards, plus per-route checks and mandate scoping in lib/dashboard-profiles.ts",
  },
  {
    key: "editor",
    label: "Editor",
    summary: "Prepares data and drafts publications. Cannot publish or commit their own work.",
    can: [
      "Upload files and validate them",
      "Use the data terminal and manual entry",
      "Submit a validated upload for administrative approval",
      "Draft bulletin editions and write commentary",
    ],
    cannot: [
      "Commit records to the data bank; a commit call is converted into a review submission",
      "Publish a bulletin edition",
      "Reach account management, the API control plane or the audit log",
      "Freeze or unfreeze a period",
    ],
    enforcedBy: "requireRole(req, 'editor'), and the maker-checker conversion in app/api/upload/commit/[sessionId]/route.ts",
  },
  {
    key: "admin",
    label: "Administrator",
    summary: "Runs the platform day to day: commits data, publishes, manages accounts below admin level.",
    can: [
      "Commit validated uploads to the data bank",
      "Edit and delete individual records, and mark a figure provisional, revised or final",
      "Publish bulletin editions and send broadcasts",
      "Create and deactivate viewer and editor accounts, and reset passwords",
      "Read the audit log and the revision history",
      "Publish or withdraw a series on the public API, and revoke an API key",
      "Decide access requests and answer challenges to a published figure",
    ],
    cannot: [
      "Change anyone's role, including their own",
      "Create an account at administrator level or above",
      "Issue a new API key",
      "Freeze a period, or approve an unfreeze",
    ],
    enforcedBy: "requireAdmin(req) across the admin routes; the exclusions are requireSuperadmin(req)",
  },
  {
    key: "superadmin",
    label: "Super Administrator",
    summary:
      "Holds only the levers that can rewrite the record or open a door. Deliberately not a day-to-day role.",
    can: [
      "Change any account's role, and create accounts at administrator level or above",
      "Issue an API key for the public data bank",
      "Freeze a period, locking a published figure against further change",
      "Request an unfreeze, or approve one requested by somebody else",
      "Everything an administrator can do",
    ],
    cannot: [
      "Unfreeze a period alone. It takes two different super administrators: one to request with a stated reason, another to approve",
      "Retrieve an issued API key. The secret is shown once and only a hash is stored",
      "Act without it being recorded. Every action above is written to the audit log",
    ],
    enforcedBy:
      "requireSuperadmin(req), plus the unfreeze_two_person CHECK constraint in migration 056, which the database enforces rather than the application",
  },
];

export const SCOPE_BY_ROLE: Record<string, RoleScope> = Object.fromEntries(
  ROLE_SCOPES.flatMap((s) =>
    // "staff" is the legacy stored name for editor and still appears on live
    // accounts and in issued tokens.
    s.key === "editor" ? [[s.key, s], ["staff", s]] : [[s.key, s]]
  )
);

/** The three acts separated out of day-to-day administration, and why. */
export const SEPARATED_POWERS = [
  {
    title: "Granting power",
    detail: "Changing a role, or creating an account at administrator level or above.",
    why: "A tier that can expand itself is not a boundary. An administrator could previously not promote an account to administrator, but could create one.",
  },
  {
    title: "Opening a door",
    detail: "Issuing an API key for the public data bank.",
    why: "A key is a standing credential handed to someone outside the Commission.",
  },
  {
    title: "Reopening the record",
    detail: "Unfreezing a period so a published figure can be changed.",
    why: "It is the only route by which a published national statistic can be altered, so it takes two people.",
  },
];
