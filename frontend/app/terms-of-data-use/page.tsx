import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Terms of Data Use — NEDB" };

const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: "1.75rem" }}>
    <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>{title}</h2>
    <div style={{ fontSize: "0.85rem", color: "var(--ink-3)", lineHeight: 1.7 }}>{children}</div>
  </section>
);

export default function TermsOfDataUsePage() {
  return (
    <>
      <Navbar />
      <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap" style={{ maxWidth: 760 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.3rem" }}>Energy Commission of Nigeria</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>Terms of Data Use</h1>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginBottom: "2rem" }}>Conditions for reusing statistics published on the National Energy Data Bank.</p>

          <S title="Open use with attribution">
            <p>Published statistics on NEDB may be copied, analysed, republished and used in derivative works, including commercially, provided the source is attributed as &quot;National Energy Data Bank, Energy Commission of Nigeria&quot; together with the series name and the date you accessed it.</p>
          </S>
          <S title="Provisional and revised figures">
            <p>Figures are published as provisional and may be revised as source agencies confirm returns. Each series page and bulletin states its reference period and last updated date, and the Data Revision Log records changes. When you republish a figure, include its reference period.</p>
          </S>
          <S title="No misrepresentation">
            <p>You must not present modified figures as official NEDB statistics, imply that ECN endorses your analysis, or use NEDB branding, the coat of arms, or ECN identity in a way that suggests official status.</p>
          </S>
          <S title="Restricted data">
            <p>Data supplied through an approved data request or an authenticated dashboard may carry additional conditions stated at the point of supply. Individual level assessment responses are never released.</p>
          </S>
          <p style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Last updated: 24 August 2026.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
