"use client";

// One loading and empty-state system for the public pages, replacing the
// per-page grey "Loading…" strings. The skeleton is quiet: token-coloured
// bars with a slow sheen that prefers-reduced-motion turns off entirely.
// Empty states speak in the statutory voice — they say what the absence
// means and who acts on it, never just "no data".

export function Skeleton({ h = 14, w = "100%", style }: { h?: number; w?: number | string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="nedb-skeleton"
      style={{ display: "block", height: h, width: w, borderRadius: 2, ...style }}
    />
  );
}

/** A card-shaped placeholder list for catalogue pages. */
export function SkeletonCards({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.1rem 1.25rem" }}>
          <Skeleton h={12} w={140} style={{ marginBottom: 10 }} />
          <Skeleton h={16} w="55%" style={{ marginBottom: 8 }} />
          <Skeleton h={11} w="80%" />
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function EmptyState({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "3.5rem 2rem", background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
      <div style={{ fontSize: "var(--t-base)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>{title}</div>
      <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>{body}</div>
      {children && <div style={{ marginTop: "1.25rem" }}>{children}</div>}
    </div>
  );
}
