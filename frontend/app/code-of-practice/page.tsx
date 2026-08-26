import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

// ── Code of Practice ────────────────────────────────────────────────────────
// The commitments a statistics producer makes about how it works, published so
// they can be held against it. NEDB had none: the practices existed in the code
// (maker and checker, frozen periods, the revision log, the k-anonymity floor)
// but were never written down anywhere a reader could find them.
//
// Everything on this page describes something the platform actually does. No
// commitment is listed that is not implemented, because a code of practice that
// overstates is worse than none.

export const metadata: Metadata = {
  title: "Code of Practice — National Energy Data Bank",
  description:
    "How NEDB produces, checks, publishes and corrects energy statistics: the commitments the Energy Commission of Nigeria makes about this data.",
};

const PILLARS: { n: string; title: string; body: string; practice: string[] }[] = [
  {
    n: "01",
    title: "Trustworthiness",
    body:
      "A figure is only worth as much as the process behind it. Every published number can be traced to who committed it, when, and from what source.",
    practice: [
      "No one person can both prepare and publish a figure. An editor uploads and validates; an administrator commits. The system enforces this, not a convention.",
      "Every commit, revision, deletion, freeze and publication is written to an append-only audit log.",
      "Changes to published figures appear on the public revision log, whether or not anyone asks.",
      "Issuing or withdrawing access to the data bank is recorded against the person who did it.",
    ],
  },
  {
    n: "02",
    title: "Quality",
    body:
      "Statistics are published with their limits attached. Where the data bank cannot support a claim, it says so rather than filling the gap.",
    practice: [
      "Each series carries its source, its unit, its methodology version and its reporting cadence.",
      "Cadence is read from the records themselves, not from a registry field, so a series is never described as more frequent than it is.",
      "The database enforces one figure per series, period and region. A second figure for the same period is rejected, not added.",
      "Where a period holds no record, that is shown as absent rather than as zero.",
      "The planning model marks every input as measured, derived or assumed, and never presents an assumption as a measurement.",
    ],
  },
  {
    n: "03",
    title: "Value",
    body:
      "Data is published to be used. Access is open by default and restricted only where the law or the privacy of a respondent requires it.",
    practice: [
      "Published series are available without an account, through the site and through the public API.",
      "Every chart and table can be exported.",
      "Restricted material is restricted for a stated reason, and the reason is shown to the person refused.",
    ],
  },
  {
    n: "04",
    title: "Revision and correction",
    body:
      "Publishing early and revising later is normal practice. What makes it defensible is saying which state a figure is in.",
    practice: [
      "Figures are marked provisional, revised or final.",
      "A revision changes the figure and records the old value beside the new one.",
      "A published bulletin edition is frozen. Corrections are issued as a later edition, never by editing a published one.",
      "A period can be locked so that no further change is possible without a super administrator reopening it, which is itself recorded.",
    ],
  },
  {
    n: "05",
    title: "Confidentiality",
    body:
      "Data collected from households and businesses is used to produce statistics and for nothing else.",
    practice: [
      "Assessment responses are published only as aggregates, never as individual records.",
      "Aggregates are withheld entirely until a minimum number of responses has been collected, so no single respondent can be identified.",
      "Access to identifiable assessment data is granted per person, for a stated purpose, and every view is logged.",
      "Personal data is handled under the Nigeria Data Protection Act 2023.",
    ],
  },
];

export default function CodeOfPracticePage() {
  return (
    <>
      <div className="no-print"><Navbar active="about" /></div>

      <main style={{ background: "var(--surface)", minHeight: "100vh", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap">

          <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginBottom: "0.75rem" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ margin: "0 0.5rem" }}>/</span>
            <span>Code of Practice</span>
          </div>

          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", padding: "2rem", marginBottom: "1.5rem" }}>
            <div className="eyebrow">Energy Commission of Nigeria</div>
            <h1 style={{ fontSize: "var(--t-3xl)", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.6rem" }}>
              Code of Practice
            </h1>
            <p style={{ fontSize: "var(--t-md)", color: "var(--ink-3)", lineHeight: 1.8, maxWidth: "var(--measure)" }}>
              How the National Energy Data Bank produces, checks, publishes and corrects energy statistics. Every
              commitment below describes something the platform does today. Where a practice is not yet in place it is
              named as an intention rather than listed as a commitment.
            </p>
          </div>

          {PILLARS.map((p) => (
            <div key={p.n} className="panel" style={{ marginBottom: "1.15rem" }}>
              <div className="panel-header">
                <span className="panel-title">{p.n} · {p.title}</span>
              </div>
              <div style={{ padding: "1.1rem 1.35rem" }}>
                <p style={{ fontSize: "var(--t-md)", color: "var(--ink-2)", lineHeight: 1.8, marginBottom: "0.9rem", maxWidth: "var(--measure)" }}>
                  {p.body}
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
                  {p.practice.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            </div>
          ))}

          <div className="panel" style={{ marginBottom: "1.15rem", borderLeft: "3px solid var(--amber)" }}>
            <div className="panel-header"><span className="panel-title">What this code does not yet cover</span></div>
            <div style={{ padding: "1.1rem 1.35rem" }}>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
                <li>Independent external review of methodology. Series methodology is published; it has not been externally assessed.</li>
                <li>A formal complaints and appeals route for a disputed figure. Corrections are currently raised through the data request channel.</li>
                <li>Pre-release access arrangements. No figure is currently released to any party ahead of publication, and there is no list of people who receive one.</li>
              </ul>
            </div>
          </div>

          <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", lineHeight: 1.8, borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            Related: <Link href="/statistical-confidentiality" style={{ color: "var(--green)", fontWeight: 600 }}>Statistical confidentiality</Link>
            {" · "}<Link href="/release-calendar" style={{ color: "var(--green)", fontWeight: 600 }}>Release calendar</Link>
            {" · "}<Link href="/revisions" style={{ color: "var(--green)", fontWeight: 600 }}>Revision log</Link>
            {" · "}<Link href="/terms-of-data-use" style={{ color: "var(--green)", fontWeight: 600 }}>Terms of data use</Link>
          </div>
        </div>
      </main>

      <div className="no-print"><Footer /></div>
    </>
  );
}
