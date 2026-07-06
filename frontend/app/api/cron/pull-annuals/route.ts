import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

// GET /api/cron/pull-annuals — monthly Vercel cron.
// Pulls the open OWID mirrors of Ember (electricity) and the Energy Institute
// (gas) and proposes any NEW Nigeria annual figure into energy_records, marked
// "Auto-ingested — pending review" and written to the audit log. Idempotent:
// a (series, period) that already exists is never touched.
// Auth: Vercel sends Authorization: Bearer <CRON_SECRET> when the env is set.

export const maxDuration = 60;

const PULLS = [
  {
    series: "electricity_generation",
    slug: "electricity-generation",
    unit: "GWh",
    toValue: (twh: number) => Math.round(twh * 1000),
    source: "Auto-ingested: Ember via Our World in Data",
  },
  {
    series: "natural_gas_production",
    slug: "gas-production-by-country",
    unit: "MMSCFD",
    toValue: (twh: number) => Math.round(twh * 9.675), // TWh → bcm(/10) → MMscf/d
    source: "Auto-ingested: Energy Institute via Our World in Data",
  },
];

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("Unauthorized", 401);
  }

  const results: Record<string, string> = {};

  for (const p of PULLS) {
    try {
      const res = await fetch(`https://ourworldindata.org/grapher/${p.slug}.csv`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) { results[p.series] = `fetch ${res.status}`; continue; }
      const csv = await res.text();

      // Nigeria rows: Entity,Code,Year,Value
      const rows = csv.split("\n")
        .filter((l) => l.startsWith("Nigeria,"))
        .map((l) => l.split(","))
        .map((c) => ({ year: parseInt(c[2]), twh: parseFloat(c[3]) }))
        .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.twh) && r.year >= 2000)
        // OWID sometimes carries a provisional current-year estimate — skip it
        .filter((r) => r.year < new Date().getFullYear());

      if (!rows.length) { results[p.series] = "no rows"; continue; }

      const { data: existing } = await db()
        .from("energy_records")
        .select("period")
        .eq("series_type_id", p.series)
        .eq("region", "NGA");
      const have = new Set((existing ?? []).map((e) => e.period));

      const fresh = rows.filter((r) => !have.has(String(r.year)));
      if (!fresh.length) { results[p.series] = "up to date"; continue; }

      const records = fresh.map((r) => ({
        series_type_id: p.series,
        period: String(r.year),
        period_date: `${r.year}-01-01`,
        region: "NGA",
        value: p.toValue(r.twh),
        unit: p.unit,
        source: p.source,
        notes: "Auto-ingested — pending review",
        methodology_version: "v1",
      }));
      const { error } = await db().from("energy_records").insert(records);
      if (error) { results[p.series] = `insert: ${error.message}`; continue; }

      await db().from("audit_log").insert(fresh.map((r) => ({
        action: "auto_ingest",
        series_type_id: p.series,
        period: String(r.year),
        region: "NGA",
        new_value: p.toValue(r.twh),
        performed_by: "cron:pull-annuals",
        notes: p.source,
      }))).then(() => {}, () => {});

      results[p.series] = `added ${fresh.length}: ${fresh.map((r) => r.year).join(", ")}`;
    } catch (e) {
      results[p.series] = e instanceof Error ? e.message : "error";
    }
  }

  return ok({ ran_at: new Date().toISOString(), results });
}
