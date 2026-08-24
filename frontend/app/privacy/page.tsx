import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Privacy Notice — NEDB" };

const S = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginBottom: "1.75rem" }}>
    <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>{title}</h2>
    <div style={{ fontSize: "0.85rem", color: "var(--ink-3)", lineHeight: 1.7 }}>{children}</div>
  </section>
);

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap" style={{ maxWidth: 760 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.3rem" }}>Energy Commission of Nigeria</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>Privacy Notice</h1>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginBottom: "2rem" }}>How the National Energy Data Bank handles personal data, under the Nigeria Data Protection Act 2023.</p>

          <S title="What we collect">
            <p>Most of NEDB is statistical data about the energy sector and contains no personal data. We collect personal data only when you submit it to us: a data request (name, organisation, email, purpose), a dashboard access request (name, organisation, official email, justification), a newsletter subscription (email), or a PENA field assessment response (contact email, location, household energy and income information).</p>
          </S>
          <S title="How we use it">
            <p>Request details are used to process and respond to your request. Assessment responses are used to produce anonymised, aggregated energy statistics. Published statistics never identify an individual: any state or local government area with fewer responses than the privacy floor is withheld from open data.</p>
          </S>
          <S title="Your rights">
            <p>Under the Nigeria Data Protection Act 2023 you may request access to, correction of, or deletion of your personal data. Verified deletion requests for assessment responses are honoured permanently and are recorded in an internal audit log. Contact the Energy Commission of Nigeria through energy.gov.ng to exercise these rights.</p>
          </S>
          <S title="Retention and security">
            <p>Personal data is retained only as long as needed for the purpose it was collected for. Access to identifiable assessment responses is restricted to authorised NEDB staff and protected by authentication and role-based access control.</p>
          </S>
          <p style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Last updated: 24 August 2026.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
