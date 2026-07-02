import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";
import { cacheDel } from "@/lib/redis";
import { sendApprovalEmail, sendRejectionEmail } from "@/lib/mailer";

// POST /api/upload/review/:sessionId — admin approve or reject
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);

  const { sessionId } = await params;
  const body = await req.json().catch(() => null);
  const action = body?.action as "approve" | "reject" | undefined;
  if (!action || !["approve", "reject"].includes(action)) return err("action must be approve or reject", 400);

  const client = db();

  const { data: session } = await client
    .from("upload_sessions")
    .select("id, series_type_id, status, validated_rows, uploaded_by")
    .eq("id", sessionId)
    .single();

  if (!session) return err("session not found", 404);
  if (session.status !== "pending_review") return err(`session is "${session.status}", not pending review`, 409);

  if (action === "reject") {
    await client.from("upload_sessions").update({ status: "rejected" }).eq("id", sessionId);

    // Email uploader
    if (session.uploaded_by) {
      const { data: staffRow } = await client.from("staff_users").select("email, full_name").eq("username", session.uploaded_by).single();
      const { data: seriesRow } = await client.from("series_types").select("name").eq("id", session.series_type_id).single();
      if (staffRow?.email) {
        await sendRejectionEmail({ to: staffRow.email, uploaderName: staffRow.full_name ?? session.uploaded_by, seriesName: seriesRow?.name ?? session.series_type_id, rejectedBy: claims.username, sessionId: Number(sessionId) });
      }
    }

    return ok({ rejected: Number(sessionId), message: "Upload rejected." });
  }

  // Approve: commit the validated rows
  if (!session.validated_rows?.length) return err("no validated rows to commit", 400);

  const { error: insertErr } = await client.from("energy_records").insert(session.validated_rows);
  if (insertErr) return err("failed to insert records: " + insertErr.message, 500);

  await client.from("upload_sessions").update({
    status: "committed",
    uploaded_by: session.uploaded_by ?? claims.username,
  }).eq("id", sessionId);

  // Audit log
  try {
    await client.from("audit_log").insert({
      action: "INSERT",
      series_type_id: session.series_type_id,
      record_id: null,
      performed_by: claims.username,
      notes: `Approved upload session ${sessionId} — ${session.validated_rows.length} records committed`,
    });
  } catch { /* non-fatal */ }

  await cacheDel(`stats:${session.series_type_id}`, "series:list");

  // Email uploader
  if (session.uploaded_by) {
    const { data: staffRow } = await client.from("staff_users").select("email, full_name").eq("username", session.uploaded_by).single();
    const { data: seriesRow } = await client.from("series_types").select("name").eq("id", session.series_type_id).single();
    if (staffRow?.email) {
      await sendApprovalEmail({ to: staffRow.email, uploaderName: staffRow.full_name ?? session.uploaded_by, seriesName: seriesRow?.name ?? session.series_type_id, committedRows: session.validated_rows.length, approvedBy: claims.username, sessionId: Number(sessionId) });
    }
  }

  return ok({
    approved: Number(sessionId),
    committed_rows: session.validated_rows.length,
    series_type_id: session.series_type_id,
  });
}
