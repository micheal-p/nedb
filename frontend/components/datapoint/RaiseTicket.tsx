"use client";

// ── RaiseTicket ─────────────────────────────────────────────────────────────
// A ticket raised from inside the dashboard, carrying where the person was
// when they hit the problem. A report that says "the gas figure looks wrong"
// with the page, series and period attached can be acted on; the same report
// arriving as a phone call cannot.

import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getTokenFresh } from "@/lib/auth";

const CATEGORIES = [
  { id: "data_quality", label: "A figure looks wrong", hint: "Wrong value, wrong unit, missing period" },
  { id: "upload",       label: "Upload or validation", hint: "A file will not validate or commit" },
  { id: "access",       label: "Access or permissions", hint: "Something you should be able to see, but cannot" },
  { id: "feature",      label: "Request a change",     hint: "A view or export you need that does not exist" },
  { id: "other",        label: "Something else",       hint: "" },
];

export default function RaiseTicket({ seriesId, period, compact }: { seriesId?: string; period?: string; compact?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("data_quality");
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setSubject(""); setBody(""); setCategory("data_quality"); setPriority("normal");
    setDone(null); setError("");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) { setError("A subject and a description are both needed."); return; }
    setBusy(true); setError("");
    try {
      const token = await getTokenFresh();
      const r = await fetch("/api/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          subject, body, category, priority,
          context_path: pathname, series_id: seriesId ?? null, period: period ?? null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Could not raise the ticket."); return; }
      setDone(j.reference);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => { reset(); setOpen(true); }}
        className={compact ? "btn btn-secondary btn-sm" : "btn btn-secondary"}
        title="Report a problem with what you are looking at">
        Report a problem
      </button>
    );
  }

  return (
    <div role="dialog" aria-label="Report a problem"
      style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div onClick={() => !busy && setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div className="sheet-on-mobile" style={{ position: "relative", background: "var(--surface-white)", border: "1px solid var(--border)", width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", boxShadow: "var(--shadow-3)" }}>

        <div style={{ background: "var(--ink)", color: "#fff", padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Support</div>
            <div style={{ fontSize: "var(--t-md)", fontWeight: 700 }}>{done ? "Ticket raised" : "Report a problem"}</div>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close"
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontSize: "1.3rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {done ? (
          <div style={{ padding: "1.5rem 1.35rem" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--t-lg)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>{done}</div>
            <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.7, marginBottom: "1.25rem" }}>
              Quote this reference in any follow-up. You can track it under Support on your dashboard, and you will see
              the response there when the data management unit replies.
            </p>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button onClick={() => setOpen(false)} className="btn btn-primary btn-sm">Done</button>
              <button onClick={reset} className="btn btn-secondary btn-sm">Raise another</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: "1.15rem 1.35rem 1.35rem" }}>
            {/* Context is captured for them, not asked of them */}
            <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", padding: "0.6rem 0.8rem", marginBottom: "1rem", fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.6 }}>
              Attached automatically: <code style={{ fontFamily: "var(--font-mono)" }}>{pathname}</code>
              {seriesId ? <> · series <code style={{ fontFamily: "var(--font-mono)" }}>{seriesId}</code></> : null}
              {period ? <> · period <code style={{ fontFamily: "var(--font-mono)" }}>{period}</code></> : null}
            </div>

            <div style={{ marginBottom: "0.9rem" }}>
              <span className="form-label">What kind of problem?</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {CATEGORIES.map((c) => (
                  <label key={c.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", padding: "0.45rem 0.6rem",
                    border: `1px solid ${category === c.id ? "var(--green)" : "var(--border)"}`,
                    background: category === c.id ? "var(--green-tint)" : "var(--surface-white)",
                  }}>
                    <input type="radio" name="cat" checked={category === c.id} onChange={() => setCategory(c.id)}
                      style={{ accentColor: "var(--green)", marginTop: 3 }} />
                    <span>
                      <span style={{ display: "block", fontSize: "var(--t-base)", color: "var(--ink)", fontWeight: category === c.id ? 600 : 400 }}>{c.label}</span>
                      {c.hint && <span style={{ display: "block", fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{c.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <span className="form-label">Subject</span>
              <input className="form-input" value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Gas production for June looks an order of magnitude too high" />
            </label>

            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              <span className="form-label">What did you see, and what did you expect?</span>
              <textarea className="form-input" rows={4} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="The dashboard shows 49,120 Bcf for 2026-06. NUPRC's monthly report gives 4,912. Looks like a decimal shift on ingest."
                style={{ resize: "vertical", lineHeight: 1.6 }} />
            </label>

            <label style={{ display: "block", marginBottom: "1rem" }}>
              <span className="form-label">Priority</span>
              <div style={{ display: "flex", gap: "1rem" }}>
                {[["low", "Low"], ["normal", "Normal"], ["high", "High — a published figure is wrong"]].map(([v, l]) => (
                  <label key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--t-sm)", color: "var(--ink-2)", cursor: "pointer" }}>
                    <input type="radio" name="pri" checked={priority === v} onChange={() => setPriority(v)} style={{ accentColor: "var(--green)" }} />
                    {l}
                  </label>
                ))}
              </div>
            </label>

            {error && <div style={{ fontSize: "var(--t-sm)", color: "var(--red)", background: "var(--red-tint)", border: "1px solid var(--red)", padding: "0.5rem 0.8rem", marginBottom: "0.9rem" }}>{error}</div>}

            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Raising…" : "Raise ticket"}</button>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary" disabled={busy}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
