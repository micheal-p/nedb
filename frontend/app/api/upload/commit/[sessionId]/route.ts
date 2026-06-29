import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const claims = await requireAuth(req);
  if (!claims) return err("authentication required", 401);

  const { sessionId } = await params;
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

  await client.from("upload_sessions").update({ status: "committed" }).eq("id", sessionId);

  return ok({ committed_rows: session.validated_rows.length, series_type_id: session.series_type_id });
}
