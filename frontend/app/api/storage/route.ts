import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireSuperadmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// Storage allocation.
// POST  — any signed-in staff member asks for more space, with a reason.
// GET   — superadmin: pending requests and current allocations.
// PATCH — superadmin decides: grant sets the new quota, decline records why.
// Quotas are a superadmin power on purpose: storage is a budget, and budgets
// have owners.

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const mb = Number(body?.requested_mb);
  if (!isFinite(mb) || mb < 50 || mb > 10240) return err("Ask for between 50MB and 10GB.");
  const { data, error } = await db()
    .from("storage_requests")
    .insert({ username: String(auth.username ?? auth.sub), requested_mb: Math.round(mb), reason: String(body?.reason ?? "").slice(0, 500) || null })
    .select("id, created_at").single();
  if (error) return err(error.message, 500);
  return ok({ id: data.id, message: "Request recorded — a superadmin will decide on it." }, 201);
}

export async function GET(req: NextRequest) {
  const admin = await requireSuperadmin(req);
  if (!admin) return err("Superadmin only", 403);
  const [{ data: requests }, { data: allocations }] = await Promise.all([
    db().from("storage_requests").select("*").order("created_at", { ascending: false }).limit(100),
    db().from("storage_allocations").select("*").order("updated_at", { ascending: false }).limit(200),
  ]);
  return ok({ requests: requests ?? [], allocations: allocations ?? [] });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperadmin(req);
  if (!admin) return err("Superadmin only", 403);
  const who = String(admin.username ?? admin.sub ?? "unknown");
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!id || !["granted", "declined"].includes(body?.decision)) return err("id and decision (granted | declined) required");

  const { data: r } = await db().from("storage_requests").select("*").eq("id", id).single();
  if (!r) return err("Request not found", 404);
  if (r.status !== "pending") return err("Already decided.");

  if (body.decision === "granted") {
    const quota = Number(body.quota_mb ?? r.requested_mb + 200);
    const { error: ae } = await db()
      .from("storage_allocations")
      .upsert({ username: r.username, quota_mb: Math.round(quota), granted_by: who, updated_at: new Date().toISOString() });
    if (ae) return err(ae.message, 500);
  }
  const { error } = await db()
    .from("storage_requests")
    .update({ status: body.decision, decided_by: who, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return err(error.message, 500);

  await logAudit({
    action: body.decision === "granted" ? "STORAGE_GRANTED" : "STORAGE_DECLINED",
    performed_by: who,
    notes: `${body.decision === "granted" ? `Granted ${body.quota_mb ?? r.requested_mb + 200}MB planning storage to` : "Declined storage request from"} ${r.username}`,
  });
  return ok({ success: true });
}
