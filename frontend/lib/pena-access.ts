// ── lib/pena-access.ts ──────────────────────────────────────────────────────
// Who may see a PENA assessment's insights, and the record of who did.
//
// PENA insights sit on personal data. Three levels:
//   aggregate     — charts, tiers, state and LGA averages. No personal fields.
//   identifiable  — the response table with email, address and coordinates.
//   export        — taking the identifiable data off the platform.
//
// Administrators hold all three. A restricted assessment is visible only to
// the users explicitly granted on it. Every identifiable access is logged,
// because under NDPA 2023 "who looked at this person's data" must be an
// answerable question.

import { db } from "@/lib/supabase-server";

export type AccessLevel = "none" | "aggregate" | "identifiable" | "export";

export type PenaViewer = {
  username: string;
  role: string;
  level: AccessLevel;
  reason: string;      // shown in the UI so the viewer knows why they see what they see
};

const isAdmin = (role: string) => role === "admin" || role === "superadmin";

export async function resolveAccess(
  formId: number,
  username: string,
  role: string
): Promise<PenaViewer> {
  if (isAdmin(role)) {
    return {
      username, role, level: "export",
      reason: "You are an administrator, so you can see identifiable responses and export them. Every access is logged.",
    };
  }

  const { data: form } = await db()
    .from("pena_forms")
    .select("id, is_restricted, owner_agency")
    .eq("id", formId)
    .single();

  if (!form) return { username, role, level: "none", reason: "Assessment not found." };

  const { data: grant } = await db()
    .from("pena_form_access")
    .select("can_export")
    .eq("form_id", formId)
    .eq("username", username)
    .maybeSingle();

  if (form.is_restricted && !grant) {
    return {
      username, role, level: "none",
      reason: `This assessment is restricted${form.owner_agency ? ` to ${form.owner_agency}` : ""}. Ask an administrator for access.`,
    };
  }

  if (grant) {
    return {
      username, role,
      level: grant.can_export ? "export" : "identifiable",
      reason: grant.can_export
        ? "You have been granted full access to this assessment, including export. Every access is logged."
        : "You have been granted access to identifiable responses on this assessment. Export is not included, and every access is logged.",
    };
  }

  return {
    username, role, level: "aggregate",
    reason: "You can see aggregate findings. Identifiable responses — emails, addresses and exact locations — are withheld from your role.",
  };
}

/** Record an access. Never allowed to break the request it is recording. */
export async function logView(
  formId: number,
  username: string,
  action: "view" | "export" | "detail",
  identifiable: boolean
) {
  try {
    await db().from("pena_view_log").insert({
      form_id: formId, username, action, identifiable,
    });
  } catch (e) {
    console.error("pena_view_log insert failed:", e);
  }
}

/** Recent accesses on an assessment, newest first. */
export async function recentViews(formId: number, limit = 50) {
  const { data } = await db()
    .from("pena_view_log")
    .select("username, action, identifiable, viewed_at")
    .eq("form_id", formId)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
