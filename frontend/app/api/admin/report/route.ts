import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { getCycleStatus, sendMonthlyReport } from "@/lib/monthly-report";

// GET  /api/admin/report — cycle status + recipient counts
// POST /api/admin/report {force?} — push the report now.
//   If the cycle isn't due and force is not set → 409 with the exact warning,
//   so the UI can ask "are you sure?". A forced early push never moves the
//   anchor: the next automatic send still fires on the original timeline.

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const [cycle, { count: subCount }, { count: staffCount }] = await Promise.all([
    getCycleStatus(),
    db().from("subscribers").select("*", { count: "exact", head: true }).eq("is_active", true),
    db().from("staff_users").select("*", { count: "exact", head: true }).eq("is_active", true).not("email", "is", null),
  ]);
  if (!cycle) return err("report_state missing — run migration 029", 500);

  return ok({ cycle, subscribers: subCount ?? 0, staff: staffCount ?? 0 });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  if ((auth as { role?: string }).role !== "admin") return err("Admin only", 403);

  const body = await req.json().catch(() => ({}));
  const cycle = await getCycleStatus();
  if (!cycle) return err("report_state missing — run migration 029", 500);

  if (!cycle.due && !body?.force) {
    return Response.json({
      error: "not_due",
      days_left: cycle.days_left,
      due_at: cycle.due_at,
      message: `The report is still collecting — ${cycle.days_left} day(s) to the scheduled send. Pushing now will email everyone immediately, but the automatic send will STILL wait for its scheduled date (${new Date(cycle.due_at).toLocaleDateString("en-NG")}). The timeline is not reset.`,
    }, { status: 409 });
  }

  const result = await sendMonthlyReport(cycle.due ? "scheduled" : "manual");
  return ok({ pushed: true, via: cycle.due ? "scheduled" : "manual", ...result });
}
