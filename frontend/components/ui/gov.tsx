"use client";

// ── components/ui/gov.tsx ───────────────────────────────────────────────────
// Shared government-standard primitives. Every page composes these instead of
// redefining Kicker/Tile/StatTile locally, so the pattern cannot drift.
// Flat surfaces, 1px rules, one sans face, provenance everywhere.

import { ReactNode, useState } from "react";

/* Section kicker: small uppercase label with a hairline rule */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-3)", margin: "0 0 0.625rem", display: "flex", alignItems: "center", gap: 8 }}>
      {children}
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

/* Plain page header: caption line, one heading, one sentence of context */
export function PageHeader({ caption, title, lede, actions }: { caption?: string; title: string; lede?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.75rem" }}>
      <div style={{ maxWidth: 700 }}>
        {caption && <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.3rem" }}>{caption}</div>}
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: 0, lineHeight: 1.25 }}>{title}</h1>
        {lede && <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.45rem", lineHeight: 1.6 }}>{lede}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: "0.625rem", alignItems: "center", flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

/* Breadcrumb trail: plain text links, no icons */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginBottom: "0.875rem" }}>
      {items.map((it, i) => (
        <span key={i}>
          {it.href ? <a href={it.href} style={{ color: "var(--green)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>{it.label}</a> : <span>{it.label}</span>}
          {i < items.length - 1 && <span style={{ margin: "0 0.5rem", color: "var(--ink-5)" }}>/</span>}
        </span>
      ))}
    </nav>
  );
}

/* GOV.UK-style stat block: label, large number, unit, change, source line.
   Flat, rule-separated, no card floating. */
export function StatBlock({ label, value, unit, change, changeDirection, sub, source }: {
  label: string; value: string; unit?: string;
  change?: string;                       /* e.g. "+4.1% vs 2024" — signed text */
  changeDirection?: "good" | "bad" | "neutral";
  sub?: string; source?: string;
}) {
  const changeColor = changeDirection === "good" ? "var(--green)" : changeDirection === "bad" ? "var(--red)" : "var(--ink-4)";
  return (
    <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1rem 1.2rem", minWidth: 0, flex: "1 1 170px" }}>
      <div style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: "1.55rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}{unit && <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-3)", marginLeft: 5 }}>{unit}</span>}
      </div>
      {change && <div style={{ fontSize: "0.72rem", fontWeight: 600, color: changeColor, marginTop: 5 }}>{change}</div>}
      {sub && <div style={{ fontSize: "0.68rem", color: "var(--ink-4)", marginTop: 4, lineHeight: 1.45 }}>{sub}</div>}
      {source && <SourceLine bare>{source}</SourceLine>}
    </div>
  );
}

/* Provenance line: source, unit, period, last updated. Mandatory furniture. */
export function SourceLine({ children, bare }: { children: ReactNode; bare?: boolean }) {
  return (
    <div style={{ fontSize: "0.66rem", color: "var(--ink-5)", lineHeight: 1.5, ...(bare ? { marginTop: 6 } : { padding: "0.55rem 1.25rem", borderTop: "1px solid var(--border-soft)", background: "var(--surface-muted)" }) }}>
      {children}
    </div>
  );
}

/* Active filter chips with one clear-all */
export function FilterChips({ chips, onClear, onClearAll }: {
  chips: { key: string; label: string }[];
  onClear: (key: string) => void;
  onClearAll: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "0.5rem 0" }}>
      <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>Filters:</span>
      {chips.map((c) => (
        <button key={c.key} onClick={() => onClear(c.key)} title={`Remove filter ${c.label}`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.72rem", fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: 2, padding: "2px 8px", cursor: "pointer" }}>
          {c.label}
          <span aria-hidden style={{ color: "var(--ink-4)", fontWeight: 700 }}>×</span>
        </button>
      ))}
      <button onClick={onClearAll} style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--green)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
        Clear all
      </button>
    </div>
  );
}

/* Awaiting-data notice: honest replacement for "Coming Soon" ghost panels */
export function AwaitingData({ title, agencies, series }: { title: string; agencies: string[]; series?: string[] }) {
  return (
    <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1.5rem 1.75rem" }}>
      <div style={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--amber)", marginBottom: "0.5rem" }}>Awaiting data submission</div>
      <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.35rem" }}>{title}</div>
      <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>
        This indicator set is awaiting data submission from {agencies.join(", ")}. It will populate automatically once records are committed.
      </p>
      {series && series.length > 0 && (
        <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.6, margin: "0.5rem 0 0" }}>
          Covers: {series.join(" · ")}
        </p>
      )}
    </div>
  );
}

/* In-page confirmation panel: replaces window.confirm(), which blocks the
   browser and reads unprofessional. Renders inline where mounted. */
export function ConfirmPanel({ title, body, confirmLabel, danger, onConfirm, onCancel, busy }: {
  title: string; body: string; confirmLabel: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; busy?: boolean;
}) {
  return (
    <div role="alertdialog" aria-label={title} style={{ background: danger ? "var(--red-tint)" : "var(--surface-muted)", border: `1px solid ${danger ? "var(--red)" : "var(--border)"}`, padding: "1rem 1.25rem", margin: "0.75rem 0" }}>
      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: danger ? "var(--red)" : "var(--ink)", marginBottom: "0.3rem" }}>{title}</div>
      <p style={{ fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 0.75rem" }}>{body}</p>
      <div style={{ display: "flex", gap: "0.6rem" }}>
        <button onClick={onConfirm} disabled={busy}
          style={{ padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 700, background: danger ? "var(--red)" : "var(--green)", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Working…" : confirmLabel}
        </button>
        <button onClick={onCancel} disabled={busy}
          style={{ padding: "0.45rem 1rem", fontSize: "0.78rem", fontWeight: 600, background: "var(--surface-white)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: 2, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* GOV.UK-style error summary: listed at the top of a form, links to fields */
export function ErrorSummary({ errors }: { errors: { anchor?: string; message: string }[] }) {
  if (!errors.length) return null;
  return (
    <div role="alert" tabIndex={-1} id="error-summary"
      style={{ background: "var(--surface-white)", border: "3px solid var(--red)", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>There is a problem</div>
      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
        {errors.map((e, i) => (
          <li key={i} style={{ fontSize: "0.8rem", lineHeight: 1.7 }}>
            {e.anchor
              ? <a href={`#${e.anchor}`} style={{ color: "var(--red)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>{e.message}</a>
              : <span style={{ color: "var(--red)", fontWeight: 600 }}>{e.message}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* USWDS-style official banner explainer. The .gov-banner strip stays; this
   adds the collapsible "Here's how you know" beneath it. */
export function OfficialBanner() {
  const [open, setOpen] = useState(false);
  return (
    <div className="official-notice" style={{ background: "var(--surface-muted)", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--ink-2)" }}>
      <div style={{ maxWidth: "var(--max-w)", margin: "0 auto", padding: "4px 2rem" }}>
        <span>An official service of the Energy Commission of Nigeria.</span>{" "}
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
          style={{ background: "none", border: "none", color: "var(--blue)", textDecoration: "underline", textUnderlineOffset: 2, fontSize: "0.72rem", cursor: "pointer", padding: 0 }}>
          Here&apos;s how you know
        </button>
        {open && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", padding: "0.75rem 0 0.5rem", lineHeight: 1.6 }}>
            <div>
              <strong>Official websites use verified domains.</strong>{" "}
              The Energy Commission of Nigeria is established under the ECN Act, CAP. E10, LFN 2004. Its official website is energy.gov.ng.
            </div>
            <div>
              <strong>Secure connections use HTTPS.</strong>{" "}
              A lock icon in your browser means information you send to this service is encrypted in transit.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
