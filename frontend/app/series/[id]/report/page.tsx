import Link from "next/link";
import { db } from "@/lib/supabase-server";
import ReportView from "@/components/report/ReportView";
import type { EnergyRecord } from "@/lib/api";
import type { ReportMeta } from "@/lib/report-model";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SeriesReport({ params }: Props) {
  const { id } = await params;

  const [{ data: series }, { data: records }] = await Promise.all([
    db()
      .from("series_types")
      .select("id, name, sector, unit_default, frequency, source_agency, what_is, how_to_read, why_it_matters")
      .eq("id", id)
      .single(),
    db()
      .from("energy_records")
      .select("*")
      .eq("series_type_id", id)
      .order("period_date", { ascending: true })
      .limit(1000),
  ]);

  if (!series) {
    return (
      <div style={{ padding: "6rem 2rem", textAlign: "center" }}>
        <h1 style={{ marginBottom: "1rem" }}>Series not found</h1>
        <Link href="/" className="btn btn-secondary">Back to Data Bank</Link>
      </div>
    );
  }

  const meta: ReportMeta = {
    seriesId: series.id,
    name: series.name,
    unit: series.unit_default,
    sector: series.sector,
    frequency: series.frequency,
    sourceAgency: series.source_agency ?? undefined,
    whatIs: series.what_is,
    howToRead: series.how_to_read,
    whyItMatters: series.why_it_matters,
  };

  return <ReportView meta={meta} records={(records ?? []) as EnergyRecord[]} />;
}
