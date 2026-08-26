import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { K_ANON_MIN } from "@/lib/pena";

// ── Statistical confidentiality ─────────────────────────────────────────────
// What NEDB does with data collected from identifiable people, and the specific
// controls that stop a published aggregate identifying one of them.
//
// The k-anonymity threshold is imported rather than written into the copy, so
// this page cannot drift away from the value the code actually enforces.

export const metadata: Metadata = {
  title: "Statistical confidentiality — National Energy Data Bank",
  description:
    "How NEDB protects data collected from households and businesses: aggregation thresholds, access control, and the legal basis under the Nigeria Data Protection Act 2023.",
};

export default function ConfidentialityPage() {
  return (
    <>
      <div className="no-print"><Navbar active="about" /></div>

      <main style={{ background: "var(--surface)", minHeight: "100vh", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap">

          <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginBottom: "0.75rem" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ margin: "0 0.5rem" }}>/</span>
            <span>Statistical confidentiality</span>
          </div>

          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", padding: "2rem", marginBottom: "1.5rem" }}>
            <div className="eyebrow">Energy Commission of Nigeria</div>
            <h1 style={{ fontSize: "var(--t-3xl)", fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: "0.6rem" }}>
              Statistical confidentiality
            </h1>
            <p style={{ fontSize: "var(--t-md)", color: "var(--ink-3)", lineHeight: 1.8, maxWidth: "var(--measure)" }}>
              Some of the data behind these statistics is collected directly from households and businesses through
              energy assessments. This page states plainly what happens to it, what is published, and what never is.
            </p>
          </div>

          <div className="panel" style={{ marginBottom: "1.15rem" }}>
            <div className="panel-header"><span className="panel-title">The single commitment</span></div>
            <div style={{ padding: "1.2rem 1.35rem" }}>
              <p style={{ fontSize: "var(--t-lg)", color: "var(--ink)", lineHeight: 1.7, fontWeight: 600, maxWidth: "var(--measure)", margin: 0 }}>
                Information you give us is used to produce statistics. It is not used to decide anything about you, it is
                not sold, and it is not passed to anyone who could act against you with it.
              </p>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: "1.15rem" }}>
            <div className="panel-header">
              <span className="panel-title">What is published</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>Aggregates only</span>
            </div>
            <div style={{ padding: "1.1rem 1.35rem" }}>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
                <li>
                  <strong style={{ color: "var(--ink-2)" }}>Nothing publishes below {K_ANON_MIN} responses.</strong> An
                  assessment with fewer than {K_ANON_MIN} verified responses shows a collection progress notice and no
                  figures at all. This is enforced on the server, so the numbers are not merely hidden from the page,
                  they are never sent to it.
                </li>
                <li>Names, email addresses, phone numbers and street addresses are never published, at any threshold.</li>
                <li>Published geography is aggregated to local government area. An individual response is never mapped on its own.</li>
                <li>Income, energy spending and supply hours publish as distributions and averages, never as rows.</li>
              </ul>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: "1.15rem" }}>
            <div className="panel-header"><span className="panel-title">Who inside NEDB can see identifiable responses</span></div>
            <div style={{ padding: "1.1rem 1.35rem" }}>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
                <li>Access is granted per person and per assessment, not by job title.</li>
                <li>It is granted at one of three levels: aggregate figures only, identifiable responses, or full export.</li>
                <li>Every view of identifiable data is logged against the person who viewed it.</li>
                <li>A grant states the purpose it was given for, and can be withdrawn.</li>
              </ul>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: "1.15rem" }}>
            <div className="panel-header"><span className="panel-title">Your rights</span></div>
            <div style={{ padding: "1.1rem 1.35rem" }}>
              <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.85, marginBottom: "0.8rem", maxWidth: "var(--measure)" }}>
                Assessments are voluntary and consent based. Under the Nigeria Data Protection Act 2023 you may ask what
                we hold about you, ask for it to be corrected, or ask for it to be deleted. Deleting a response removes
                it from every published aggregate at the next recalculation.
              </p>
              <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.85, margin: 0, maxWidth: "var(--measure)" }}>
                Requests go through the <Link href="/request-data" style={{ color: "var(--green)", fontWeight: 600 }}>data request channel</Link>.
              </p>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: "1.15rem", borderLeft: "3px solid var(--amber)" }}>
            <div className="panel-header"><span className="panel-title">What we cannot promise</span></div>
            <div style={{ padding: "1.1rem 1.35rem" }}>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
                <li>
                  A threshold of {K_ANON_MIN} responses protects against identifying an individual from a published
                  aggregate. It is not a guarantee against someone who already knows a great deal about a specific
                  respondent and is deliberately trying to confirm it.
                </li>
                <li>Where a lawful order requires disclosure, we must comply. We would seek to narrow any such request.</li>
              </ul>
            </div>
          </div>

          <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", lineHeight: 1.8, borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            Related: <Link href="/code-of-practice" style={{ color: "var(--green)", fontWeight: 600 }}>Code of Practice</Link>
            {" · "}<Link href="/privacy" style={{ color: "var(--green)", fontWeight: 600 }}>Privacy notice</Link>
            {" · "}<Link href="/assessments" style={{ color: "var(--green)", fontWeight: 600 }}>Open assessment data</Link>
          </div>
        </div>
      </main>

      <div className="no-print"><Footer /></div>
    </>
  );
}
