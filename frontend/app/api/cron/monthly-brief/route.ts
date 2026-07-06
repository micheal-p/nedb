import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { getCycleStatus, sendMonthlyReport } from "@/lib/monthly-report";

// GET /api/cron/monthly-brief — runs DAILY; sends only when the 31-day cycle
// is due, then advances the anchor (see lib/monthly-report.ts for semantics).

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("Unauthorized", 401);
  }

  const cycle = await getCycleStatus();
  if (!cycle) return err("report_state missing — run migration 029", 500);
  if (!cycle.due) {
    return ok({ ran_at: new Date().toISOString(), sent: 0, status: `collecting — ${cycle.days_left} day(s) left` });
  }

  const result = await sendMonthlyReport("scheduled");
  return ok({ ran_at: new Date().toISOString(), ...result, status: "scheduled send complete" });
}
