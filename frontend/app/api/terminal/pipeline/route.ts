import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireRole } from "@/lib/api-helpers";

// GET /api/terminal/pipeline — everything in flight, in one call.
//
// The terminal's whole point is that a data officer sees the state of the
// pipeline at a glance rather than assembling it from five screens: what is
// staged, what is waiting on a decision, what landed recently, and — the part
// nobody usually has — which series are overdue or have holes in them.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, "editor");
  if (!auth) return err("editor access or above is required", 403);

  const [{ data: sessions }, { data: seriesRows }, { data: recent }, { data: frozen }, { data: anomalies }] = await Promise.all([
    db().from("upload_sessions")
      .select("id, series_type_id, filename, status, row_count, error_count, uploaded_by, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
    db().from("series_types")
      .select("id, name, sector, unit_default, frequency, is_public, energy_records(count)")
      .order("sector").order("name"),
    db().from("audit_log")
      .select("action, series_type_id, period, old_value, new_value, performed_by, performed_at, notes")
      .order("performed_at", { ascending: false })
      .limit(25),
    db().from("frozen_periods").select("series_type_id, period, reason"),
    db().from("anomalies").select("id, series_type_id, period, severity, message, status")
      .eq("status", "open").order("id", { ascending: false }).limit(25),
  ]);

  const series = (seriesRows ?? []).map((s: Record<string, unknown>) => ({
    id: s.id as string,
    name: s.name as string,
    sector: s.sector as string,
    unit_default: s.unit_default as string,
    frequency: s.frequency as string,
    is_public: !!s.is_public,
    record_count: (s.energy_records as { count: number }[] | null)?.[0]?.count ?? 0,
  }));

  // Coverage: for each series, how current is it and where are the holes?
  // A statistics office is judged on the gaps, so the terminal leads with them.
  const coverage = await Promise.all(
    series.map(async (s) => {
      const { data: rows } = await db()
        .from("energy_records")
        .select("period, period_date")
        .eq("series_type_id", s.id)
        .order("period_date", { ascending: false })
        .limit(48);

      const periods = (rows ?? []).map((r) => String(r.period));
      const latest = rows?.[0] ?? null;
      const latestDate = latest ? new Date(String(latest.period_date)) : null;

      // How many periods behind is this series, given its own frequency?
      let periodsBehind: number | null = null;
      if (latestDate) {
        const now = new Date();
        const months = (now.getFullYear() - latestDate.getFullYear()) * 12 + (now.getMonth() - latestDate.getMonth());
        periodsBehind = s.frequency === "monthly" ? months
          : s.frequency === "quarterly" ? Math.floor(months / 3)
          : now.getFullYear() - latestDate.getFullYear();
      }

      // Holes inside the covered range — a series can look current and still be
      // missing the middle.
      let gaps: string[] = [];
      if (s.frequency === "monthly" && rows && rows.length > 1) {
        const have = new Set(periods);
        const newest = new Date(String(rows[0].period_date));
        const oldest = new Date(String(rows[rows.length - 1].period_date));
        const cursor = new Date(oldest);
        while (cursor <= newest) {
          const p = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
          if (!have.has(p)) gaps.push(p);
          cursor.setMonth(cursor.getMonth() + 1);
        }
        gaps = gaps.slice(0, 12);
      }

      return {
        id: s.id, name: s.name, sector: s.sector, frequency: s.frequency,
        is_public: s.is_public, record_count: s.record_count,
        latest_period: latest ? String(latest.period) : null,
        periods_behind: periodsBehind,
        gaps,
      };
    })
  );

  return ok({
    sessions: sessions ?? [],
    series,
    coverage,
    recent: recent ?? [],
    frozen: frozen ?? [],
    anomalies: anomalies ?? [],
    role: (auth as { role?: string }).role ?? "editor",
  });
}
