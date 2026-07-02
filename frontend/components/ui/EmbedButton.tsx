"use client";
import { useState } from "react";

interface Props { seriesId: string }

export default function EmbedButton({ seriesId }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://nedb.energy.gov.ng";
  const code = `<iframe src="${origin}/embed/${seriesId}" width="640" height="420" frameborder="0" allowtransparency="true" loading="lazy" title="NEDB - Energy Data Chart"></iframe>`;

  function copy() {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>Embed</button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "var(--r-lg)", padding: "1.75rem", maxWidth: 560, width: "100%", boxShadow: "0 20px 60px rgba(10,10,10,0.18)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "0.25rem" }}>Embed this chart</div>
            <div style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginBottom: "1rem" }}>Copy the code below and paste it into any HTML page.</div>

            <pre style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "0.875rem 1rem", fontSize: "0.72rem", fontFamily: "var(--font-mono)", wordBreak: "break-all", whiteSpace: "pre-wrap", color: "var(--ink-3)", margin: "0 0 0.875rem" }}>
              {code}
            </pre>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={copy} style={{ flex: 1 }}>
                {copied ? "Copied!" : "Copy embed code"}
              </button>
              <a href={`/embed/${seriesId}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Preview</a>
              <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
