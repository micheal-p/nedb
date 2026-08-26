import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { db } from "@/lib/supabase-server";

// ── Release calendar ────────────────────────────────────────────────────────
// Pre-announced publication dates. This matters more than it sounds: a producer
// that announces when a figure will appear, before it knows what the figure is,
// cannot later be accused of having held it back or timed its release. It is
// the cheapest piece of statistical independence there is.
//
// The forward schedule is derived from a stated rule rather than a hand-kept
// list, so it cannot silently go stale. What has already been published is read
// from the editions table, so the page can never claim a release that did not
// happen.

export const metadata: Metadata = {
  title: "Release calendar — National Energy Data Bank",
  description:
    "When NEDB statistics are published. Pre-announced dates for the Energy Bulletin and its quarterly and annual editions.",
};

export const revalidate = 3600;

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/**
 * Move a release off a weekend to the following Monday.
 *
 * A statistics body does not publish on a Saturday, and a calendar that says it
 * will is a promise it will not keep. The rule is applied here rather than left
 * as a caveat in the prose, so the dates on the page are the dates.
 */
function nextWorkingDay(d: Date): Date {
  const day = d.getUTCDay();               // 0 Sunday, 6 Saturday
  if (day === 0) return new Date(d.getTime() + 86_400_000);
  if (day === 6) return new Date(d.getTime() + 2 * 86_400_000);
  return d;
}

/** Monthly bulletin: published on the 15th, covering the month before. */
function monthlyReleases(from: Date, count: number) {
  const out: { releaseOn: Date; covers: string; kind: string }[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  for (let i = 0; i < count; i++) {
    const scheduled = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 15));
    const covered = new Date(Date.UTC(scheduled.getUTCFullYear(), scheduled.getUTCMonth() - 1, 1));
    out.push({
      releaseOn: nextWorkingDay(scheduled),
      covers: `${MONTHS[covered.getUTCMonth()]} ${covered.getUTCFullYear()}`,
      kind: "Monthly Energy Bulletin",
    });
  }
  return out;
}

/** Quarterly bulletin: published on the last day of the month after quarter end. */
function quarterlyReleases(from: Date, count: number) {
  const out: { releaseOn: Date; covers: string; kind: string }[] = [];
  let y = from.getUTCFullYear();
  let q = Math.floor(from.getUTCMonth() / 3) + 1;
  for (let i = 0; i < count; i++) {
    // Quarter q ends in month q*3, so the release is the 28th of the month
    // after that: Q1 ends March, publishes 28 April.
    const releaseOn = nextWorkingDay(new Date(Date.UTC(y, q * 3, 28)));
    out.push({ releaseOn, covers: `Q${q} ${y}`, kind: "Quarterly Energy Bulletin" });
    q += 1;
    if (q > 4) { q = 1; y += 1; }
  }
  return out;
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function ReleaseCalendarPage() {
  const now = new Date();

  const { data: published } = await db()
    .from("bulletin_editions")
    .select("edition_no, title, period_label, period_kind, status, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(12);

  const upcoming = [...monthlyReleases(now, 6), ...quarterlyReleases(now, 3)]
    .filter((r) => r.releaseOn.getTime() >= now.getTime() - 86_400_000)
    .sort((a, b) => a.releaseOn.getTime() - b.releaseOn.getTime())
    .slice(0, 8);

  return (
    <>
      <div className="no-print"><Navbar active="databank" /></div>

      <main style={{ background: "var(--surface)", minHeight: "100vh", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap">

          <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginBottom: "0.75rem" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ margin: "0 0.5rem" }}>/</span>
            <span>Release calendar</span>
          </div>

          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", padding: "2rem", marginBottom: "1.5rem" }}>
            <div className="eyebrow">Energy Commission of Nigeria</div>
            <h1 style={{ fontSize: "var(--t-3xl)", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.6rem" }}>
              Release calendar
            </h1>
            <p style={{ fontSize: "var(--t-md)", color: "var(--ink-3)", lineHeight: 1.8, maxWidth: "var(--measure)" }}>
              When NEDB statistics are published. Dates are announced in advance and do not depend on what the figures
              turn out to say. Where a release will be late, this page says so before the date rather than after it.
            </p>
          </div>

          <div className="panel" style={{ marginBottom: "1.15rem" }}>
            <div className="panel-header">
              <span className="panel-title">Publication rule</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>What the schedule below is derived from</span>
            </div>
            <div style={{ padding: "1.1rem 1.35rem" }}>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
                <li><strong style={{ color: "var(--ink-2)" }}>Monthly Energy Bulletin</strong> — the 15th of each month, covering the month before.</li>
                <li><strong style={{ color: "var(--ink-2)" }}>Quarterly Energy Bulletin</strong> — the 28th of the month following quarter end, with the Q1 to Q4 comparison.</li>
                <li><strong style={{ color: "var(--ink-2)" }}>Annual Energy Bulletin</strong> — 28 February, covering the preceding calendar year.</li>
                <li>Figures are published as provisional where the underlying returns are incomplete, and marked as such.</li>
                <li>No figure is released to any party ahead of the published time.</li>
              </ul>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: "1.15rem" }}>
            <div className="panel-header">
              <span className="panel-title">Next releases</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>All times 09:00 West Africa Time</span>
            </div>
            <div className="scroll-x">
              <table className="data-table">
                <thead><tr><th>Release date</th><th>Publication</th><th>Period covered</th></tr></thead>
                <tbody>
                  {upcoming.map((r) => (
                    <tr key={`${r.kind}-${r.covers}`}>
                      <td className="td-primary" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtDate(r.releaseOn)}</td>
                      <td style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)" }}>{r.kind}</td>
                      <td style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)" }}>{r.covers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="chart-source">
              Derived from the publication rule above. A date falling on a weekend is shown moved to the following Monday. A date falling on a public holiday moves to the next working day, which is applied when the holiday calendar is confirmed.
            </div>
          </div>

          <div className="panel" style={{ marginBottom: "1.15rem" }}>
            <div className="panel-header">
              <span className="panel-title">Already published</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>{published?.length ?? 0} editions</span>
            </div>
            {!published?.length ? (
              <div style={{ padding: "1.1rem 1.35rem", fontSize: "var(--t-base)", color: "var(--ink-4)", lineHeight: 1.75 }}>
                No edition has been published yet. The schedule above is what NEDB is committing to; this table will
                record what was actually delivered against it, including anything published late.
              </div>
            ) : (
              <div className="scroll-x">
                <table className="data-table">
                  <thead><tr><th>Published</th><th>Edition</th><th>Period covered</th></tr></thead>
                  <tbody>
                    {published.map((e) => (
                      <tr key={e.edition_no}>
                        <td className="td-primary" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {e.published_at ? fmtDate(new Date(e.published_at)) : "—"}
                        </td>
                        <td style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)" }}>
                          <Link href={`/bulletin/${e.edition_no}`} style={{ color: "var(--green)", fontWeight: 600 }}>
                            No. {e.edition_no}
                          </Link>
                          {" — "}{e.title}
                        </td>
                        <td style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)" }}>{e.period_label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", lineHeight: 1.8, borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            Related: <Link href="/code-of-practice" style={{ color: "var(--green)", fontWeight: 600 }}>Code of Practice</Link>
            {" · "}<Link href="/bulletin" style={{ color: "var(--green)", fontWeight: 600 }}>Energy Bulletin</Link>
            {" · "}<Link href="/revisions" style={{ color: "var(--green)", fontWeight: 600 }}>Revision log</Link>
          </div>
        </div>
      </main>

      <div className="no-print"><Footer /></div>
    </>
  );
}
