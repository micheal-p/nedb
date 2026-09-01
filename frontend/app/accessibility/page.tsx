import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = { title: "Accessibility Statement — NEDB" };

export default function AccessibilityPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem" }}>
        <div className="page-wrap" style={{ maxWidth: 760 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.3rem" }}>Energy Commission of Nigeria</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>Accessibility Statement</h1>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginBottom: "2rem" }}>Our commitment to making the National Energy Data Bank usable by everyone.</p>

          <div style={{ fontSize: "0.85rem", color: "var(--ink-3)", lineHeight: 1.7 }}>
            <p style={{ marginBottom: "1rem" }}>
              NEDB is built to conform to the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. That includes sufficient colour contrast, visible keyboard focus states, text alternatives for charts (every chart offers its data as a table and a CSV download), forms with labelled fields and clear error messages, and layouts that work at small screen sizes and high zoom levels.
            </p>
            <p style={{ marginBottom: "1rem" }}>
              Charts and maps never rely on colour alone: direction of change is always shown with a signed number and a marker alongside the colour.
            </p>
            <p style={{ marginBottom: "1rem" }}>
              The service offers four appearance settings — system, light, dark, and a high-contrast mode with pure
              blacks, hard borders and underlined links — switchable from the navigation bar on every page and applied
              before the page first paints. A &quot;skip to main content&quot; link is the first control reached by
              keyboard on every page, keyboard focus is marked with a visible ring in all themes, and animation is
              disabled entirely for readers whose systems request reduced motion.
            </p>
            <p style={{ marginBottom: "1rem" }}>
              Some interactive maps may be difficult to use with a keyboard alone. The same figures are always available in the accompanying tables on the same page.
            </p>
            <p>
              If you find part of this service inaccessible, contact the Energy Commission of Nigeria through energy.gov.ng and we will provide the information in an accessible format.
            </p>
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--ink-5)", marginTop: "1.75rem" }}>Last updated: 1 September 2026.</p>
        </div>
      </main>
      <Footer />
    </>
  );
}
