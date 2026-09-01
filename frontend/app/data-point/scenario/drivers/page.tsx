"use client";

// ── Driver documentation ────────────────────────────────────────────────────
// One note per driver, MacKay-style: what it is, exactly how it enters the
// arithmetic, where a defensible number comes from, and what moving it does.
// A planner should be able to defend every slider position in a meeting.

import Link from "next/link";
import NecalGate from "@/components/necal/NecalGate";
import { DRIVER_DOCS, MIX_DOC } from "@/lib/necal-docs";

function DriversBody() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem 1.25rem 4rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div className="eyebrow">NECAL2050 · Model Documentation</div>
            <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--ink)", margin: 0 }}>The drivers, documented</h1>
            <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", marginTop: "0.35rem", maxWidth: "var(--measure)", lineHeight: 1.7 }}>
              Every driver in the calculator, with how it enters the arithmetic and where a defensible value comes
              from. The model is deterministic: the same drivers always produce the same plan.
            </p>
          </div>
          <Link href="/data-point/scenario" className="btn btn-secondary btn-sm">← Calculator</Link>
        </div>

        {DRIVER_DOCS.map((d) => (
          <div key={d.key} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1.15rem 1.4rem", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ fontSize: "var(--t-base)", fontWeight: 700, color: "var(--ink)" }}>{d.label}</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{d.unit}</span>
            </div>
            <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.7, marginTop: "0.4rem" }}>{d.what}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              {[["In the model", d.in_the_model], ["Defensible sources", d.sources], ["What moving it does", d.moving_it]].map(([h, t]) => (
                <div key={h} style={{ borderTop: "2px solid var(--border)", paddingTop: "0.4rem" }}>
                  <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--green)" }}>{h}</div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", lineHeight: 1.65, marginTop: 3 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1.15rem 1.4rem" }}>
          <div style={{ fontSize: "var(--t-base)", fontWeight: 700, color: "var(--ink)" }}>The generation mix</div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.7, marginTop: "0.4rem" }}>{MIX_DOC.what}</div>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.7, marginTop: "0.4rem" }}>{MIX_DOC.in_the_model}</div>
          <div style={{ fontSize: "var(--t-xs)", color: "var(--amber)", fontWeight: 600, lineHeight: 1.6, marginTop: "0.6rem" }}>{MIX_DOC.caveat}</div>
        </div>
      </div>
    </div>
  );
}

export default function DriversPage() {
  return <NecalGate><DriversBody /></NecalGate>;
}
