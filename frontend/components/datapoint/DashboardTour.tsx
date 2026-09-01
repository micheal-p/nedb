"use client";

// First-visit tour of the Data Point dashboard. Five short cards, not a
// hijack: skippable at every step, never shown again once dismissed (per
// browser, localStorage), and re-openable from the Take the tour button the
// dashboard can render. Card-based rather than element-anchored on purpose —
// an arrow pointing at a panel that moved is worse than no arrow.

import { useState, useEffect, useCallback } from "react";

const KEY = "nedb_tour_done";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Welcome to your workspace",
    body: "This dashboard is scoped to your agency's mandate: the series, indicators and views your role is entitled to see. Everything here is built from committed records — figures that carry a source, a period and a revision history.",
  },
  {
    title: "The sidebar is your map",
    body: "Views on the left switch the whole dashboard: overview, sector views, and any custom tabs built for your profile. Below them sit the tools your role holds — PENA assessments, the National Energy Calculator, data vintages and working papers for administrators.",
  },
  {
    title: "Read a figure, then check it",
    body: "Every chart offers its data as a table, and every number can be traced to the record behind it. If a figure looks wrong, the Revision Log shows every change ever made to it, and the anomaly feed flags movements worth a second look.",
  },
  {
    title: "Ask Apex AI",
    body: "The assistant in the corner answers from the data bank itself — committed records, the knowledge graph and Nigeria's energy laws. Statistics it quotes carry a record marker you can hover to verify. If the bank does not hold a figure, it says so rather than guessing.",
  },
  {
    title: "Your work leaves a trail",
    body: "Uploads go through review before they become official figures, commits are maker-checker, and actions are written to the audit log under your name. That trail is what makes the bank's numbers defensible — including yours.",
  },
];

export function tourSeen(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return true; }
}

export default function DashboardTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => { if (open) setStep(0); }, [open]);

  const finish = useCallback(() => {
    try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div role="dialog" aria-modal="true" aria-label="Dashboard tour"
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(10,14,16,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.25rem" }}
      onClick={finish}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", maxWidth: 440, width: "100%", padding: "1.6rem 1.75rem 1.25rem", boxShadow: "var(--shadow-3)" }}>
        <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: 6 }}>
          Tour · {step + 1} of {STEPS.length}
        </div>
        <div style={{ fontSize: "var(--t-lg)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>{s.title}</div>
        <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.7, margin: "0 0 1.1rem" }}>{s.body}</p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: 5 }} aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === step ? "var(--green)" : "var(--border)" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {!last && <button className="btn btn-secondary btn-sm" onClick={finish}>Skip</button>}
            {step > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setStep(step - 1)}>Back</button>}
            {!last && <button className="btn btn-primary btn-sm" onClick={() => setStep(step + 1)} autoFocus>Next</button>}
            {last && <button className="btn btn-primary btn-sm" onClick={finish} autoFocus>Start working</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
