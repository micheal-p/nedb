import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BulletinView from "@/components/BulletinView";
import { db } from "@/lib/supabase-server";
import { getBulletinData, type BulletinData } from "@/lib/bulletin-data";

// /bulletin — the latest PUBLISHED edition is the page (frozen, citable).
// If no edition has been published yet, a live provisional view renders,
// clearly marked. The archive of numbered editions lists below either way.

export const dynamic = "force-dynamic";

type EditionRow = {
  edition_no: number; title: string; period_label: string; status: string;
  commentary: Record<string, string>; snapshot: BulletinData;
  data_cutoff: string; published_at: string | null;
};

export default async function BulletinPage() {
  const { data: editions } = await db()
    .from("bulletin_editions")
    .select("edition_no, title, period_label, status, commentary, snapshot, data_cutoff, published_at")
    .eq("status", "published")
    .order("edition_no", { ascending: false });

  const published = (editions ?? []) as EditionRow[];
  const latest = published[0] ?? null;

  const data: BulletinData = latest ? latest.snapshot : await getBulletinData();
  const meta = latest
    ? { editionNo: latest.edition_no, periodLabel: latest.period_label, publishedAt: latest.published_at, dataCutoff: latest.data_cutoff, provisional: false, commentary: latest.commentary }
    : { periodLabel: new Date().toLocaleDateString("en-NG", { month: "long", year: "numeric" }), dataCutoff: data.generated_at, provisional: true };

  return (
    <>
      <div className="no-print"><Navbar active="databank" /></div>
      <BulletinView data={data} meta={meta} />

      {/* Archive */}
      <div className="no-print" style={{ background: "var(--surface)", padding: "0 0 5rem" }}>
        <div className="page-wrap">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Past Editions</span>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Numbered, frozen, citable</span>
            </div>
            {published.length === 0 ? (
              <div style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                No editions published yet. The view above is provisional and recomputes from live records; the first numbered edition becomes the permanent citable record when it is published.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Edition</th><th>Period</th><th style={{ textAlign: "right" }}>Data cutoff</th><th style={{ textAlign: "right" }}>Published</th></tr>
                </thead>
                <tbody>
                  {published.map((e) => (
                    <tr key={e.edition_no}>
                      <td className="td-primary">
                        <Link href={`/bulletin/${e.edition_no}`} style={{ color: "var(--green)", fontWeight: 600 }}>No. {e.edition_no}</Link>
                      </td>
                      <td>{e.period_label}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>{new Date(e.data_cutoff).toLocaleDateString("en-NG")}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>{e.published_at ? new Date(e.published_at).toLocaleDateString("en-NG") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="no-print"><Footer /></div>
    </>
  );
}
