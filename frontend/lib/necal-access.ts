// ── lib/necal-access.ts ─────────────────────────────────────────────────────
// Server-side enforcement for the NECAL2050 planning model.
//
// The client gate is presentation: it explains a refusal politely. It cannot be
// the boundary, because the profile it reads comes from localStorage, which the
// visitor controls, and it defaults to "executive" when nothing is stored — a
// profile that holds the capability. So a cleared browser would have walked
// straight in.
//
// This reads the profile from the signed JWT instead, and every NECAL route
// calls it.

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { PROFILE_MAP, hasCapability } from "@/lib/dashboard-profiles";

export type NecalAccess =
  | { ok: true; profileKey: string; username: string }
  | { ok: false; status: number; error: string };

const ADMIN_ROLES = new Set(["admin", "superadmin"]);

export async function requireNecal(req: NextRequest): Promise<NecalAccess> {
  const auth = await requireAuth(req);
  if (!auth) return { ok: false, status: 401, error: "Authentication required." };

  const role = String((auth as { role?: string }).role ?? "");
  const username = String(auth.username ?? auth.sub ?? "unknown");

  // Administrators can always reach it — somebody has to be able to check the
  // instrument itself.
  if (ADMIN_ROLES.has(role)) return { ok: true, profileKey: "admin", username };

  // No stored profile means no grant. Absence is not a licence.
  const key = String((auth as { dashboard_profile?: string }).dashboard_profile ?? "");
  const profile = key ? PROFILE_MAP[key] : undefined;
  if (!profile || !hasCapability(profile, "necal")) {
    return {
      ok: false,
      status: 403,
      error: "NECAL2050 is held by profiles with a national planning mandate. Ask an administrator for planning access.",
    };
  }

  return { ok: true, profileKey: key, username };
}
