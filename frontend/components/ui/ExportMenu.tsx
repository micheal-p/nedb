"use client";

// One calm "Export ▾" menu replacing five separate subheader buttons:
// CSV · Excel · Template · Print/PDF · Embed widget.

import { useEffect, useRef, useState } from "react";

interface Props {
  seriesId: string;
  templateUrl: string;
}

export default function ExportMenu({ seriesId, templateUrl }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);

  const item: React.CSSProperties = {
    display: "block", width: "100%", textAlign: "left", padding: "8px 14px",
    fontSize: "0.78rem", color: "var(--ink)", background: "none", border: "none",
    cursor: "pointer", textDecoration: "none",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        Export
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 5, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40, minWidth: 190, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 8px 28px rgba(0,0,0,0.14)", overflow: "hidden", padding: "4px 0" }}>
          <a href={`/api/series/${seriesId}/export?format=csv`} download style={item} onClick={() => setOpen(false)}>Download CSV</a>
          <a href={`/api/series/${seriesId}/export?format=xlsx`} download style={item} onClick={() => setOpen(false)}>Download Excel</a>
          <a href={templateUrl} style={item} onClick={() => setOpen(false)}>Upload template (XLSX)</a>
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <button style={item} onClick={() => { setOpen(false); window.print(); }}>Print / Save PDF</button>
          <a href={`/embed/${seriesId}`} target="_blank" rel="noopener noreferrer" style={item} onClick={() => setOpen(false)}>Embed widget ↗</a>
        </div>
      )}
    </div>
  );
}
