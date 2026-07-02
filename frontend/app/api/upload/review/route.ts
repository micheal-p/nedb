import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAuth, requireAdmin, ok, err } from "@/lib/api-helpers";

// GET /api/upload/review — admin: list all pending_review sessions
export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);

  const { data, error } = await db()
    .from("upload_sessions")
    .select("id, series_type_id, filename, row_count, error_count, status, uploaded_by, created_at")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);
  return ok({ sessions: data ?? [] });
}

// POST /api/upload/review — staff: submit a validated session for review
export async function POST(req: NextRequest) {
  const claims = await requireAuth(req);
  if (!claims) return err("authentication required", 401);

  const body = await req.json().catch(() => null);
  if (!body?.session_id) return err("session_id required", 400);

  const client = db();

  const { data: session } = await client
    .from("upload_sessions")
    .select("id, status, uploaded_by")
    .eq("id", body.session_id)
    .single();

  if (!session) return err("session not found", 404);
  if (session.status !== "validated") return err(`cannot submit: session is "${session.status}"`, 409);

  await client
    .from("upload_sessions")
    .update({ status: "pending_review", uploaded_by: claims.username })
    .eq("id", body.session_id);

  return ok({ submitted: body.session_id, message: "Upload submitted for admin review." });
}
