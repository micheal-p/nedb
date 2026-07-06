import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { cacheDel } from "@/lib/redis";
import { detectAndFlag } from "@/lib/anomaly";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return err("authentication required", 401);

  const { sessionId } = await params;

  // Server-side enforcement of the approval workflow: only administrators
  // commit. A staff call is converted into a review submission instead —
  // the UI already routes staff there; this closes the direct-API path.
  if ((claims as { role?: string }).role !== "admin") {
    await db().from("upload_sessions").update({ status: "pending_review" }).eq("id", sessionId);
    return ok({ pending_review: true, message: "Submitted for admin approval" });
  }
  const client = db();

  const { data: session } = await client
    .from("upload_sessions")
    .select("id, series_type_id, status, validated_rows")
    .eq("id", sessionId)
    .single();

  if (!session) return err("session not found", 404);
  if (session.status === "committed") return err("session already committed", 409);
  if (!session.validated_rows?.length) return err("no valid rows to commit", 400);

  const { error: insertErr } = await client.from("energy_records").insert(session.validated_rows);
  if (insertErr) return err("failed to insert records: " + insertErr.message, 500);

  await client.from("upload_sessions").update({ status: "committed", uploaded_by: claims.username }).eq("id", sessionId);
  await cacheDel(`stats:${session.series_type_id}`, "series:list");

  // Anomaly detection — fetch the just-inserted records by session id
  const { data: inserted } = await client.from("energy_records").select("id, series_type_id, period, region, value").eq("upload_session_id", Number(sessionId));
  if (inserted?.length) detectAndFlag(inserted).catch(() => {});

  return ok({ committed_rows: session.validated_rows.length, series_type_id: session.series_type_id });
}
