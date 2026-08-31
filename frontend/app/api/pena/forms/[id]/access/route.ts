import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { recentViews } from "@/lib/pena-access";
import { cacheDel } from "@/lib/redis";
import { logAudit } from "@/lib/audit";

// GET /api/pena/forms/:id/access — who may see this assessment, and who has.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin access required", 403);
  const { id } = await params;

  const [{ data: form }, { data: grants }, views, { data: staff }] = await Promise.all([
    db().from("pena_forms").select("id, title, slug, is_restricted, owner_agency, is_public_stats").eq("id", id).single(),
    db().from("pena_form_access").select("username, can_export, granted_by, granted_at").eq("form_id", id).order("granted_at"),
    recentViews(Number(id)),
    db().from("staff_users").select("username, full_name, role, agency").eq("is_active", true).order("full_name"),
  ]);

  if (!form) return err("Assessment not found", 404);
  return ok({ form, grants: grants ?? [], views, staff: staff ?? [] });
}

// PUT /api/pena/forms/:id/access — restrict/unrestrict, grant, revoke.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin access required", 403);
  const { id } = await params;
  const who = String(admin.username ?? admin.sub ?? "unknown");

  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const { data: form } = await db().from("pena_forms").select("id, title, slug, is_public_stats").eq("id", id).single();
  if (!form) return err("Assessment not found", 404);

  // Restrict or open the assessment.
  //
  // is_restricted and is_public_stats are independent switches: restricting an
  // assessment limits which STAFF may open it, and does nothing to the
  // k-anonymised aggregates published at /assessments/<slug>. An admin who
  // restricts an assessment expecting it to be locked down would leave the
  // open-data page up. The panel now says so and offers to withdraw it in the
  // same action; the withdrawal stays deliberate rather than automatic,
  // because silently pulling published open data is its own kind of wrong for
  // a statistics producer.
  if (body.is_restricted !== undefined) {
    const patch: Record<string, unknown> = {
      is_restricted: !!body.is_restricted,
      owner_agency: body.owner_agency ?? null,
    };
    const withdrawing = body.is_public_stats !== undefined && !!form.is_public_stats !== !!body.is_public_stats;
    if (body.is_public_stats !== undefined) patch.is_public_stats = !!body.is_public_stats;

    const { error } = await db().from("pena_forms").update(patch).eq("id", id);
    if (error) return err(error.message, 500);
    await logAudit({
      action: body.is_restricted ? "PENA_RESTRICT" : "PENA_UNRESTRICT",
      performed_by: who,
      notes: `${body.is_restricted ? "Restricted" : "Opened"} assessment "${form.title}"${body.owner_agency ? ` to ${body.owner_agency}` : ""}`,
    });
    if (withdrawing) {
      await logAudit({
        action: body.is_public_stats ? "PENA_PUBLISH_STATS" : "PENA_WITHDRAW_STATS",
        performed_by: who,
        notes: `${body.is_public_stats ? "Published" : "Withdrew"} open-data aggregates for "${form.title}"`,
      });
      if (form.slug) await cacheDel(`pena:pub:${form.slug}`);
    }
    return ok({ updated: true, is_public_stats: patch.is_public_stats ?? form.is_public_stats });
  }

  // Grant access to a named user
  if (body.grant) {
    const username = String(body.grant).trim();
    if (!username) return err("username is required");
    const { error } = await db()
      .from("pena_form_access")
      .upsert({ form_id: Number(id), username, can_export: !!body.can_export, granted_by: who }, { onConflict: "form_id,username" });
    if (error) return err(error.message, 500);
    await logAudit({
      action: "PENA_GRANT",
      performed_by: who,
      notes: `Granted ${username} ${body.can_export ? "export" : "view"} access to "${form.title}"`,
    });
    return ok({ granted: username });
  }

  // Revoke
  if (body.revoke) {
    const username = String(body.revoke).trim();
    const { error } = await db().from("pena_form_access").delete().eq("form_id", id).eq("username", username);
    if (error) return err(error.message, 500);
    await logAudit({
      action: "PENA_REVOKE",
      performed_by: who,
      notes: `Revoked ${username}'s access to "${form.title}"`,
    });
    return ok({ revoked: username });
  }

  return err("nothing to do");
}
