import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAuth, roleRank, ok, err } from "@/lib/api-helpers";
import { commitRecords, type IncomingRecord } from "@/lib/commit-records";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return err("authentication required", 401);

  const { sessionId } = await params;
  const client = db();

  const { data: session } = await client
    .from("upload_sessions")
    .select("id, series_type_id, status, validated_rows, uploaded_by")
    .eq("id", sessionId)
    .single();
  if (!session) return err("session not found", 404);

  // A terminal session must never be dragged back into the queue. Without
  // this guard any authenticated caller who knew the id could flip a
  // committed or rejected session back to pending_review.
  if (session.status === "committed") return err("session already committed", 409);
  if (session.status === "rejected")  return err("session was rejected — validate the file again", 409);

  // Maker-checker: only admins and superadmins commit. An editor's call is
  // converted into a review submission — the UI routes editors there already;
  // this closes the direct-API path.
  if (roleRank((claims as { role?: string }).role) < roleRank("admin")) {
    if (session.status !== "validated" && session.status !== "pending") {
      return err(`session is ${session.status} and cannot be submitted for review`, 409);
    }
    await client.from("upload_sessions").update({ status: "pending_review" }).eq("id", sessionId);
    return ok({ pending_review: true, message: "Submitted for admin approval" });
  }

  if (!session.validated_rows?.length) return err("no valid rows to commit", 400);

  const result = await commitRecords(session.validated_rows as IncomingRecord[], {
    performedBy: String(claims.username ?? claims.sub ?? "unknown"),
    reason: `Upload session ${sessionId}`,
    sessionId: Number(sessionId),
  });

  if (!result.ok) return err(result.error, 409);

  await client.from("upload_sessions").update({ status: "committed" }).eq("id", sessionId);

  return ok({
    committed_rows: result.inserted,
    replaced_rows: result.replaced,
    series_type_id: session.series_type_id,
  });
}
