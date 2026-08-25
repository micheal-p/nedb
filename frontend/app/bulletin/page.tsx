import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BulletinView from "@/components/BulletinView";
import { db } from "@/lib/supabase-server";
import { getBulletinData, defaultWindow, makeWindow, type BulletinData } from "@/lib/bulletin-data";

// /bulletin — the latest PUBLISHED edition is the page (frozen, citable).
// If no edition has been published yet, a live provisional view renders,
// clearly marked. The archive of numbered editions lists below either way.

export const dynamic = "force-dynamic";

type EditionRow = {
  edition_no: number; title: string; period_label: string; status: string;
  period_kind: string | null; period_start: string | null; period_end: string | null;
  commentary: Record<string, string>; snapshot: BulletinData;
  data_cutoff: string; published_at: string | null;
};

// ?year=2026 and ?month=8 pick an edition out of the archive, and ?kind=year
// narrows to annual editions. Without them the newest published edition is the
// page, as before.
export default async function BulletinPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; quarter?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const wantYear = Number(sp.year);
  const wantMonth = Number(sp.month);
  const wantQuarter = Number(sp.quarter);
  const wantKind = sp.kind === "year" || sp.kind === "month" || sp.kind === "quarter" ? sp.kind : null;

  // Migration 048 adds the period columns. A deploy can land before the manual
  // migration, and losing the whole published archive in that gap would be far
  // worse than losing the period filter, so this falls back.
  const withPeriod = await db()
    .from("bulletin_editions")
    .select("edition_no, title, period_label, period_kind, period_start, period_end, status, commentary, snapshot, data_cutoff, published_at")
    .eq("status", "published")
    .order("edition_no", { ascending: false });

  const editions = withPeriod.error
    ? (await db()
        .from("bulletin_editions")
        .select("edition_no, title, period_label, status, commentary, snapshot, data_cutoff, published_at")
        .eq("status", "published")
        .order("edition_no", { ascending: false })).data
    : withPeriod.data;

  const { data: storyRows } = await db()
    .from("bulletin_stories")
    .select("slug, title, standfirst, sector, author, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(8);
  const stories = storyRows ?? [];

  const published = (editions ?? []) as EditionRow[];

  // Which edition is the page: the one asked for, else the newest published.
  const matches = published.filter((e) => {
    if (wantKind && (e.period_kind ?? "month") !== wantKind) return false;
    if (!Number.isFinite(wantYear) || wantYear < 1900) return true;
    const start = e.period_start ?? "";
    if (Number.isFinite(wantQuarter) && wantQuarter >= 1 && wantQuarter <= 4) {
      const w = makeWindow("quarter", wantYear, wantQuarter);
      return start >= w.start && start <= w.end;
    }
    if (Number.isFinite(wantMonth) && wantMonth >= 1 && wantMonth <= 12) {
      const w = makeWindow("month", wantYear, wantMonth);
      return start >= w.start && start <= w.end;
    }
    return start.startsWith(String(wantYear));
  });
  const asked = Number.isFinite(wantYear) || wantKind !== null;
  const latest = (asked ? matches[0] : published[0]) ?? null;
  const askedButMissing = asked && !latest;

  // A provisional view is built for last month, which is what a monthly
  // bulletin reports on, rather than for "whatever the newest record is".
  const provisionalWindow = defaultWindow();
  const data: BulletinData = latest ? latest.snapshot : await getBulletinData(provisionalWindow);
  const meta = latest
    ? { editionNo: latest.edition_no, periodLabel: latest.period_label, publishedAt: latest.published_at, dataCutoff: latest.data_cutoff, provisional: false, commentary: latest.commentary }
    : { periodLabel: provisionalWindow.label, dataCutoff: data.generated_at, provisional: true };

  return (
    <>
      <div className="no-print"><Navbar active="databank" /></div>

      {askedButMissing && (
        <div className="no-print" style={{ background: "var(--surface)", padding: "1rem 0 0" }}>
          <div className="page-wrap">
            <div style={{ background: "var(--amber-tint)", border: "1px solid var(--amber)", padding: "0.75rem 1.05rem", fontSize: "var(--t-sm)", color: "var(--ink-2)", lineHeight: 1.65 }}>
              No published edition covers that period. Showing the provisional view for {provisionalWindow.label} instead.
              The archive below lists every edition that exists.
            </div>
          </div>
        </div>
      )}

      <BulletinView data={data} meta={meta} />

      {/* Analysis */}
      <div className="no-print" style={{ background: "var(--surface)", padding: "0 0 1.5rem" }}>
        <div className="page-wrap">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Analysis</span>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Signed commentary from the NEDB analysis unit</span>
            </div>
            {stories.length === 0 ? (
              <div style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                No analysis published yet. Statistics above are generated automatically; analysis pieces are written and
                published separately.
              </div>
            ) : (
              <div>
                {stories.map((s) => (
                  <Link key={s.slug} href={`/bulletin/stories/${s.slug}`}
                    style={{ display: "block", padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{s.title}</div>
                    {s.standfirst && <div style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.55 }}>{s.standfirst}</div>}
                    <div style={{ fontSize: "0.7rem", color: "var(--ink-5)", marginTop: 4 }}>
                      {s.author ? `${s.author} · ` : ""}
                      {s.published_at ? new Date(s.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : ""}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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
