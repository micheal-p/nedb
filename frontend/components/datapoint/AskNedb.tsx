"use client";

// ── AskNedb.tsx ─────────────────────────────────────────────────────────────
// GraphRAG assistant panel. Sends questions to /api/ask, which grounds answers
// in the ingested policy PDFs (pgvector) + the Energy Knowledge Graph, via
// Gemini free tier. Degrades to a setup notice when the key isn't configured.

import { useState } from "react";

interface Source { n: number; doc: string; file: string; similarity: number }
interface Turn { q: string; a: string; sources: Source[] }

const SUGGESTIONS = [
  "What does the Petroleum Industry Act say about royalties?",
  "What happens to Kano's power supply if Kano DisCo fails?",
  "What is the mandate of the Energy Commission of Nigeria?",
];

export default function AskNedb() {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setNotice("");
    setQ("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const j = await res.json();
      if (res.status === 503) { setNotice("Assistant not configured yet — add GEMINI_API_KEY to enable it."); return; }
      if (!res.ok) { setNotice(j.error ?? "Something went wrong."); return; }
      setTurns((t) => [...t, { q: question, a: j.answer, sources: j.sources ?? [] }]);
    } catch {
      setNotice("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gcard">
      <div className="gcard-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Ask NEDB — Policy Assistant</span>
        <span style={{ fontSize: "0.58rem", fontWeight: 700, background: "var(--green-tint)", color: "var(--green)", padding: "1px 6px", borderRadius: 3, border: "1px solid var(--green-line)", letterSpacing: "0.04em" }}>GraphRAG</span>
      </div>
      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>

        {turns.length === 0 && !notice && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.55, margin: 0 }}>
              Ask questions about Nigeria&apos;s energy laws and the energy network. Answers are grounded in the
              PIA 2021, ECN Act and policy documents plus the live knowledge graph — with citations.
            </p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} disabled={busy}
                style={{ textAlign: "left", fontSize: "0.7rem", padding: "0.45rem 0.6rem", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--ink-3)", cursor: "pointer", lineHeight: 1.4 }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink)", background: "var(--surface)", padding: "0.45rem 0.6rem", borderRadius: 6 }}>{t.q}</div>
            <div style={{ fontSize: "0.74rem", color: "var(--ink-3)", lineHeight: 1.6, whiteSpace: "pre-wrap", padding: "0.45rem 0.6rem", borderLeft: "2px solid var(--green)" }}>{t.a}</div>
            {t.sources.length > 0 && (
              <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", lineHeight: 1.5 }}>
                Sources: {t.sources.map((s) => `[${s.n}] ${s.doc}`).join(" · ")}
              </div>
            )}
          </div>
        ))}

        {busy && <div style={{ fontSize: "0.72rem", color: "var(--ink-5)", fontStyle: "italic" }}>Searching documents and graph…</div>}
        {notice && <div style={{ fontSize: "0.72rem", color: "var(--amber)", background: "var(--amber-tint, #FEF3C7)", padding: "0.45rem 0.6rem", borderRadius: 6 }}>{notice}</div>}

        <form onSubmit={(e) => { e.preventDefault(); ask(q); }} style={{ display: "flex", gap: 6 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask about energy law, policy, the grid…"
            disabled={busy}
            style={{ flex: 1, minWidth: 0, padding: "7px 10px", fontSize: "0.75rem", border: "1px solid var(--border)", borderRadius: 6 }}
          />
          <button type="submit" disabled={busy || !q.trim()}
            style={{ padding: "0 12px", fontSize: "0.72rem", fontWeight: 700, background: busy || !q.trim() ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 6, cursor: busy || !q.trim() ? "not-allowed" : "pointer" }}>
            Ask
          </button>
        </form>
        <div style={{ fontSize: "0.6rem", color: "var(--ink-5)" }}>
          Answers are AI-generated from official documents — verify against the cited instrument before formal use.
        </div>
      </div>
    </div>
  );
}
