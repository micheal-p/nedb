import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireSuperadmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// Time-boxed audit access. An external review needs the audit console for a
// fortnight, not forever: the grant carries its own expiry and dies without
// anyone remembering to revoke it. Superadmin only, and every grant is
// itself written to the log it opens.

export async function GET(req: NextRequest) {
  const admin = await requireSuperadmin(req);
  if (!admin) return err("Superadmin only", 403);
  const { data } = await db()
    .from("audit_access_grants").select("*").order("expires_at", { ascending: false }).limit(100);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await requireSuperadmin(req);
  if (!admin) return err("Superadmin only", 403);
  const who = String(admin.username ?? admin.sub ?? "unknown");
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  const hours = Number(body?.hours);
  if (!username || !isFinite(hours) || hours < 1 || hours > 24 * 90)
    return err("username and hours (1 to 2160) are required");

  const expires_at = new Date(Date.now() + hours * 3_600_000).toISOString();
  const { error } = await db()
    .from("audit_access_grants")
    .upsert({ username, expires_at, granted_by: who, granted_at: new Date().toISOString() });
  if (error) return err(error.message, 500);
  await logAudit({ action: "AUDIT_ACCESS_GRANTED", performed_by: who, notes: `Granted ${username} the audit console for ${hours}h (until ${expires_at})` });
  return ok({ username, expires_at }, 201);
}

export async function DELETE(req: NextRequest) {
  const admin = await requireSuperadmin(req);
  if (!admin) return err("Superadmin only", 403);
  const who = String(admin.username ?? admin.sub ?? "unknown");
  const username = new URL(req.url).searchParams.get("username") ?? "";
  if (!username) return err("username required");
  const { error } = await db().from("audit_access_grants").delete().eq("username", username);
  if (error) return err(error.message, 500);
  await logAudit({ action: "AUDIT_ACCESS_REVOKED", performed_by: who, notes: `Revoked ${username}'s audit console grant` });
  return ok({ success: true });
}
