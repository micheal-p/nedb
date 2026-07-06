import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { getGeminiUsage, getUsageHistory, LIMITS } from "@/lib/usage";

// GET /api/admin/apex — Apex AI observability for administrators:
// today's self-metered allowance, 7-day call history, and the question log.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const [today, history, { data: recent }, { count: totalQuestions }] = await Promise.all([
    getGeminiUsage(),
    getUsageHistory(7),
    db().from("ask_logs")
      .select("asked_at, ip, question, status, sources, duration_ms")
      .order("asked_at", { ascending: false })
      .limit(50),
    db().from("ask_logs").select("*", { count: "exact", head: true }),
  ]);

  return ok({
    today,
    limits: LIMITS,
    history,
    recent: recent ?? [],
    totalQuestions: totalQuestions ?? 0,
  });
}
