// ── lib/bulletin-data.ts ────────────────────────────────────────────────────
// Computes the bulletin statistics from committed records. Used two ways:
// the live provisional view on /bulletin, and the frozen snapshot written
// into bulletin_editions when a draft edition is created. Server-only.

import { db } from "@/lib/supabase-server";
export { SECTOR_LABEL } from "@/lib/bulletin-shared";

export type BulletinSeries = {
  id: string; name: string; sector: string; unit: string; frequency: string;
  record_count: number;
  latest: number | null; latest_period: string | null; yoy_pct: number | null;
};

export type BulletinData = {
  series: BulletinSeries[];
  sectorStats: Record<string, { label: string; count: number; records: number }>;
  totalRecords: number;
  movers: BulletinSeries[];
  generated_at: string;   // ISO — the data cutoff for a frozen edition
};

export async function getBulletinData(): Promise<BulletinData> {
  const { data: series } = await db()
    .from("series_types")
    .select("id, name, sector, unit_default, frequency, energy_records(count)")
    .order("sector").order("name");

  if (!series) return { series: [], sectorStats: {}, totalRecords: 0, movers: [], generated_at: new Date().toISOString() };

  const shaped = series.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    sector: s.sector as string,
    unit: s.unit_default as string,
    frequency: s.frequency as string,
    record_count: (s.energy_records as { count: number }[])?.[0]?.count ?? 0,
  }));

  // Latest value + yoy for each series
  const statsResults: BulletinSeries[] = await Promise.all(
    shaped.map(async (s) => {
      const { data } = await db()
        .from("energy_records")
        .select("period, value, unit")
        .eq("series_type_id", s.id)
        .order("period_date", { ascending: false })
        .limit(14);

      const rows = data ?? [];
      if (!rows.length) return { ...s, latest: null, latest_period: null, yoy_pct: null };

      const latest = rows[0];
      const yoyRow = rows.length >= 13 ? rows[12] : null;
      const yoy_pct =
        yoyRow && yoyRow.value && latest.value !== null
          ? ((latest.value - yoyRow.value) / Math.abs(yoyRow.value)) * 100
          : null;

      return { ...s, latest: latest.value, latest_period: latest.period, unit: latest.unit ?? s.unit, yoy_pct };
    })
  );

  const totalRecords = shaped.reduce((sum, s) => sum + s.record_count, 0);

  const sectorStats: Record<string, { label: string; count: number; records: number }> = {};
  for (const s of statsResults) {
    if (!sectorStats[s.sector]) {
      sectorStats[s.sector] = {
        label: s.sector.charAt(0).toUpperCase() + s.sector.slice(1),
        count: 0,
        records: 0,
      };
    }
    sectorStats[s.sector].count++;
    sectorStats[s.sector].records += s.record_count;
  }

  const movers = statsResults
    .filter((s) => s.yoy_pct !== null)
    .sort((a, b) => Math.abs(b.yoy_pct!) - Math.abs(a.yoy_pct!))
    .slice(0, 5);

  return { series: statsResults, sectorStats, totalRecords, movers, generated_at: new Date().toISOString() };
}
