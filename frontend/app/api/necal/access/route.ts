import { NextRequest } from "next/server";
import { ok } from "@/lib/api-helpers";
import { requireNecal } from "@/lib/necal-access";
import { PROFILE_MAP } from "@/lib/dashboard-profiles";

// GET /api/necal/access — does the caller hold the planning instrument?
//
// The page gate asks this rather than deciding for itself. Everything the client
// knows about its own profile comes from localStorage, which the visitor can
// edit, so the client's job is to explain the answer, not to reach it.
//
// This always answers 200, allowed true or false. A 403 would be a fine answer
// too, but the refusal page needs the same context either way, so one shape
// keeps the caller simple.
export async function GET(req: NextRequest) {
  const access = await requireNecal(req);

  const holders = Object.entries(PROFILE_MAP)
    .filter(([, p]) => p.extraViews?.includes("necal"))
    .map(([, p]) => p.label);

  if (!access.ok) {
    return ok({ allowed: false, reason: access.error, profile_label: null, holders });
  }

  const label =
    access.profileKey === "admin"
      ? "Administrator"
      : PROFILE_MAP[access.profileKey]?.label ?? access.profileKey;

  return ok({ allowed: true, reason: null, profile_label: label, holders });
}
