import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { canMove, type Stage } from "@/lib/access-pipeline";
import { sendSystemEmail } from "@/lib/mailer";
import { logAudit } from "@/lib/audit";

// PUT /api/access-requests/:id/stage — move a request along the pipeline.
//
// Provisioning is the only stage that creates anything: it mints the account
// with a generated password, records the username on the request, and emails
// the credentials. Approving does not create an account, so an approval can be
// reviewed before it becomes a live credential.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin access required", 403);
  const actor = String(admin.username ?? admin.sub ?? "unknown");
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const to = String(body?.stage ?? "") as Stage;
  if (!to) return err("stage is required");

  const { data: reqRow } = await db().from("access_requests").select("*").eq("id", id).single();
  if (!reqRow) return err("Request not found", 404);

  const from = (reqRow.stage ?? "submitted") as Stage;
  if (from === to) return err(`Request is already at ${to}.`);
  if (!canMove(from, to)) return err(`A request at "${from}" cannot move directly to "${to}".`);

  const patch: Record<string, unknown> = {
    stage: to,
    assigned_to: body?.assigned_to ?? reqRow.assigned_to ?? actor,
    decision_note: body?.note ?? reqRow.decision_note ?? null,
  };

  // Scope decided at approval, not at provisioning — the decision is the point
  // at which somebody takes responsibility for what this person may see.
  if (to === "approved") {
    patch.granted_profile = body?.granted_profile ?? reqRow.profile_key;
    patch.can_export = !!body?.can_export;
    if (body?.expires_at) patch.expires_at = body.expires_at;
    patch.status = "approved";
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = actor;
  }
  if (to === "rejected") {
    patch.status = "rejected";
    patch.reviewed_at = new Date().toISOString();
    patch.reviewed_by = actor;
  }

  let issued: { username: string; password: string } | null = null;

  // ── Provisioning ────────────────────────────────────────────────────────
  if (to === "provisioned") {
    if (reqRow.provisioned_username) {
      return err(`An account (${reqRow.provisioned_username}) already exists for this request.`, 409);
    }
    const base = String(reqRow.email).split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 20) || "user";
    let username = base;
    for (let i = 2; i < 50; i++) {
      const { data: clash } = await db().from("staff_users").select("id").eq("username", username).maybeSingle();
      if (!clash) break;
      username = `${base}${i}`;
    }
    // Generated rather than chosen by an administrator, so nobody but the
    // recipient ever knows it.
    const password = `${randomBytes(6).toString("base64url")}-${randomBytes(3).toString("base64url")}`;
    const hash = await bcrypt.hash(password, 12);

    const { error: insErr } = await db().from("staff_users").insert({
      username,
      full_name: reqRow.full_name,
      email: reqRow.email,
      role: "viewer",
      agency: reqRow.organisation ?? null,
      password_hash: hash,
      is_active: true,
      dashboard_profile: reqRow.granted_profile ?? reqRow.profile_key ?? "executive",
      created_by: actor,
    });
    if (insErr) return err(`Could not create the account: ${insErr.message}`, 500);

    patch.provisioned_username = username;
    issued = { username, password };

    await sendSystemEmail({
      to: reqRow.email,
      subject: "Your NEDB dashboard access",
      heading: "Your NEDB access is ready",
      bodyHtml: `
        <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 16px">
          Your request for access to the National Energy Data Bank has been approved.
        </p>
        <table style="font-size:14px;color:#333;margin:0 0 16px">
          <tr><td style="padding:4px 16px 4px 0;color:#666">Username</td><td style="font-weight:700">${username}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#666">Password</td><td style="font-weight:700;font-family:monospace">${password}</td></tr>
          <tr><td style="padding:4px 16px 4px 0;color:#666">Dashboard</td><td>${reqRow.granted_profile ?? reqRow.profile_key}</td></tr>
        </table>
        <p style="margin:0 0 20px">
          <a href="https://nedb.vercel.app/data-point/login" style="display:inline-block;background:#0E7A3C;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 26px">Sign in</a>
        </p>
        <p style="font-size:12px;color:#888;line-height:1.6;margin:0">
          This account is issued to you personally and must not be shared. Change the password after your first sign-in.
          Your use of the data is subject to the NEDB Terms of Data Use.
        </p>`,
    });
  }

  const { error } = await db().from("access_requests").update(patch).eq("id", id);
  if (error) return err(error.message, 500);

  await db().from("access_request_events").insert({
    request_id: Number(id), from_stage: from, to_stage: to,
    note: body?.note ?? null, actor,
  });

  await logAudit({
    action: `ACCESS_${to.toUpperCase()}`,
    performed_by: actor,
    notes: `Access request ${id} (${reqRow.full_name}, ${reqRow.organisation ?? "no organisation"}) moved ${from} → ${to}${issued ? ` — account ${issued.username} created` : ""}`,
  });

  return ok({ stage: to, issued });
}

// GET — the history of a single request
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return err("admin access required", 403);
  const { id } = await params;
  const [{ data: request }, { data: events }] = await Promise.all([
    db().from("access_requests").select("*").eq("id", id).single(),
    db().from("access_request_events").select("from_stage, to_stage, note, actor, created_at").eq("request_id", id).order("created_at"),
  ]);
  if (!request) return err("Request not found", 404);
  return ok({ request, events: events ?? [] });
}
