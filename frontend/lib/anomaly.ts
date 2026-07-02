import { db } from "@/lib/supabase-server";

interface NewRecord {
  id: number;
  series_type_id: string;
  period: string;
  region: string;
  value: number | null;
}

export async function detectAndFlag(newRecords: NewRecord[]) {
  if (!newRecords.length) return;

  const client = db();
  const seriesId = newRecords[0].series_type_id;

  // Fetch historical values for this series (exclude just-inserted rows)
  const newIds = newRecords.map((r) => r.id);
  const { data: historical } = await client
    .from("energy_records")
    .select("region, value")
    .eq("series_type_id", seriesId)
    .not("id", "in", `(${newIds.join(",")})`)
    .not("value", "is", null);

  if (!historical || historical.length < 5) return; // not enough history to detect anomalies

  // Compute mean and stddev per region
  const byRegion: Record<string, number[]> = {};
  for (const r of historical) {
    const key = r.region ?? "NGA";
    (byRegion[key] ??= []).push(r.value as number);
  }

  // Compute global stats as fallback
  const allVals = historical.map((r) => r.value as number);
  const globalMean = allVals.reduce((s, v) => s + v, 0) / allVals.length;
  const globalStd  = Math.sqrt(allVals.reduce((s, v) => s + (v - globalMean) ** 2, 0) / allVals.length);

  const flags: {
    record_id: number;
    series_type_id: string;
    period: string;
    region: string;
    value: number;
    mean_value: number;
    stddev_value: number;
    z_score: number;
  }[] = [];

  for (const rec of newRecords) {
    if (rec.value === null) continue;

    const regionVals = byRegion[rec.region] ?? allVals;
    const mean   = regionVals.reduce((s, v) => s + v, 0) / regionVals.length;
    const std    = Math.sqrt(regionVals.reduce((s, v) => s + (v - mean) ** 2, 0) / regionVals.length) || globalStd;
    if (std === 0) continue;

    const z = Math.abs((rec.value - mean) / std);
    if (z > 2.5) {
      flags.push({
        record_id:      rec.id,
        series_type_id: rec.series_type_id,
        period:         rec.period,
        region:         rec.region,
        value:          rec.value,
        mean_value:     mean,
        stddev_value:   std,
        z_score:        Math.round(z * 100) / 100,
      });
    }
  }

  if (flags.length) {
    await client.from("anomaly_flags").insert(flags);
  }
}
