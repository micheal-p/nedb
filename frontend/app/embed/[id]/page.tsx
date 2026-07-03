import { db } from "@/lib/supabase-server";
import type { EnergyRecord } from "@/lib/api";
import EmbedChart from "./EmbedChart";

interface Props { params: Promise<{ id: string }> }

async function getData(id: string) {
  const [{ data: series }, { data: records }] = await Promise.all([
    db().from("series_types").select("id, name, unit_default, frequency").eq("id", id).single(),
    db().from("energy_records").select("*").eq("series_type_id", id).order("period_date", { ascending: true }).limit(500),
  ]);
  return { series, records: (records ?? []) as EnergyRecord[] };
}

export default async function EmbedPage({ params }: Props) {
  const { id } = await params;
  const { series, records } = await getData(id);

  if (!series) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#8E867B", fontSize: 13 }}>Series not found</div>;
  }

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ padding: "12px 16px 4px", borderBottom: "1px solid #E7E5E0" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0A" }}>{series.name}</div>
          <div style={{ fontSize: 11, color: "#8E867B", marginTop: 2 }}>{series.unit_default} · {series.frequency} · ECN National Energy Data Bank</div>
        </div>
        <div style={{ padding: "4px 0" }}>
          <EmbedChart data={records} unit={series.unit_default} />
        </div>
        <div style={{ padding: "4px 16px 10px", fontSize: 10, color: "#8E867B", borderTop: "1px solid #E7E5E0", display: "flex", justifyContent: "space-between" }}>
          <span>Source: ECN / NEDB · energy.gov.ng</span>
          <a href={`/series/${id}`} target="_blank" rel="noreferrer" style={{ color: "#0E7A3C", textDecoration: "none", fontWeight: 600 }}>View full data →</a>
        </div>
      </body>
    </html>
  );
}
