import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";

// GET /api/upload/review/:sessionId/rows — the staged rows, so a reviewer can
// actually see what they are approving. Approving a batch you have not looked
// at is a slower way of committing without review.
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  if (!(await requireAdmin(req))) return err("admin access required", 403);
  const { sessionId } = await params;

  const { data } = await db()
    .from("upload_sessions")
    .select("id, series_type_id, status, validated_rows")
    .eq("id", sessionId)
    .single();
  if (!data) return err("session not found", 404);

  const rows = (data.validated_rows ?? []) as { period: string; value: number; unit: string; region: string | null; source: string | null }[];
  return ok({
    session_id: data.id,
    series_type_id: data.series_type_id,
    status: data.status,
    // Capped for the preview: a reviewer scanning 2,000 rows in a browser is
    // not reviewing, and the count tells them what is not shown.
    rows: rows.slice(0, 200),
    total: rows.length,
    truncated: rows.length > 200,
  });
}
