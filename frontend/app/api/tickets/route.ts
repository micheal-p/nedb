import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

const CATEGORIES = new Set(["data_quality", "access", "upload", "feature", "other"]);
const PRIORITIES = new Set(["low", "normal", "high"]);

// GET /api/tickets — your own tickets; administrators see everything.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("authentication required", 401);
  const me = String(auth.username ?? auth.sub ?? "");
  const isAdmin = ["admin", "superadmin"].includes(String((auth as { role?: string }).role ?? ""));

  const sp = new URL(req.url).searchParams;
  let q = db()
    .from("support_tickets")
    .select("id, reference, subject, body, category, priority, status, context_path, series_id, period, raised_by, raised_name, assigned_to, resolution, created_at, updated_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!isAdmin) q = q.eq("raised_by", me);
  if (sp.get("status") && sp.get("status") !== "all") q = q.eq("status", sp.get("status")!);

  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok({ tickets: data ?? [], is_admin: isAdmin, me });
}

// POST /api/tickets — raise one. Any signed-in user may.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("authentication required", 401);

  const body = await req.json().catch(() => null);
  const subject = String(body?.subject ?? "").trim();
  const message = String(body?.body ?? "").trim();
  if (!subject) return err("A subject is required.");
  if (!message) return err("Describe the problem so it can be reproduced.");

  const category = CATEGORIES.has(body?.category) ? body.category : "other";
  const priority = PRIORITIES.has(body?.priority) ? body.priority : "normal";

  const { data, error } = await db()
    .from("support_tickets")
    .insert({
      subject, body: message, category, priority,
      // Where the problem was seen, captured automatically by the widget so the
      // person raising it does not have to describe their own location.
      context_path: body?.context_path ?? null,
      series_id: body?.series_id ?? null,
      period: body?.period ?? null,
      raised_by: String(auth.username ?? auth.sub ?? "unknown"),
      raised_name: String(auth.full_name ?? auth.username ?? ""),
    })
    .select("id, created_at")
    .single();
  if (error) return err(error.message, 500);

  const year = new Date(data.created_at as string).getFullYear();
  const reference = `NEDB/T/${year}/${String(data.id).padStart(5, "0")}`;
  await db().from("support_tickets").update({ reference }).eq("id", data.id);

  return ok({ id: data.id, reference, message: `Ticket ${reference} raised.` }, 201);
}

// PUT /api/tickets — administrators update status, assignment or resolution.
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin access required", 403);

  const body = await req.json().catch(() => null);
  if (!body?.id) return err("id is required");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) {
    if (!["open", "in_progress", "resolved", "closed"].includes(body.status)) return err("invalid status");
    patch.status = body.status;
    if (body.status === "resolved" || body.status === "closed") patch.resolved_at = new Date().toISOString();
  }
  if (body.assigned_to !== undefined) patch.assigned_to = body.assigned_to || null;
  if (body.resolution !== undefined) patch.resolution = String(body.resolution).trim() || null;
  if (body.priority && PRIORITIES.has(body.priority)) patch.priority = body.priority;

  const { data: before } = await db().from("support_tickets").select("reference, subject").eq("id", body.id).single();
  if (!before) return err("Ticket not found", 404);

  const { error } = await db().from("support_tickets").update(patch).eq("id", body.id);
  if (error) return err(error.message, 500);

  await logAudit({
    action: "TICKET_UPDATE",
    performed_by: String(admin.username ?? admin.sub ?? "unknown"),
    notes: `${before.reference ?? `Ticket ${body.id}`} — ${Object.keys(patch).filter((k) => k !== "updated_at").join(", ")}`,
  });
  return ok({ updated: true });
}
