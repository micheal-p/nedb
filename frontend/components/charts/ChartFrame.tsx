"use client";

// ── ChartFrame ──────────────────────────────────────────────────────────────
// The shared anatomy every chart on the platform wears: title, subtitle, view
// switcher, export, legend, plot, and a mandatory provenance line.
//
// The legend lives here rather than inside each chart because identity must
// never rest on colour alone — with two or more series a legend is always
// present, and the table view is always one click away.

import { ReactNode } from "react";
import { SERIES_COLORS, NEUTRAL } from "@/lib/viz";

export type SeriesDef = { key: string; label: string; color?: string };

export type ViewKind = "line" | "area" | "bar" | "column" | "pie" | "donut" | "table";

const VIEW_LABEL: Record<ViewKind, string> = {
  line: "Line", area: "Area", bar: "Bar", column: "Column",
  pie: "Pie", donut: "Donut", table: "Table",
};

export function seriesColor(series: SeriesDef[], key: string): string {
  const i = series.findIndex((s) => s.key === key);
  const explicit = series[i]?.color;
  if (explicit) return explicit;
  return i >= 0 && i < SERIES_COLORS.length ? SERIES_COLORS[i] : NEUTRAL;
}

export default function ChartFrame({
  title, subtitle, source, note,
  series, views, view, onView,
  onExport, children, footer,
}: {
  title: string;
  subtitle?: string;
  /** Provenance: source, unit, period, last updated. Never optional in practice. */
  source?: string;
  note?: string;
  series: SeriesDef[];
  views: ViewKind[];
  view: ViewKind;
  onView: (v: ViewKind) => void;
  onExport?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // One series needs no legend box: the title already names what is plotted.
  const showLegend = series.length >= 2;

  return (
    <figure className="chart-panel" style={{ margin: 0 }}>
      <div className="chart-panel-head">
        <figcaption style={{ minWidth: 0 }}>
          <div className="chart-panel-title">{title}</div>
          {subtitle && <div className="chart-panel-sub">{subtitle}</div>}
        </figcaption>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
          <div className="viz-views" role="group" aria-label="Chart view">
            {views.map((v) => (
              <button key={v} onClick={() => onView(v)} aria-pressed={view === v}
                className={`viz-view${view === v ? " is-active" : ""}`}>
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>
          {onExport && (
            <button onClick={onExport} className="viz-export" title="Download this data as CSV">
              CSV
            </button>
          )}
        </div>
      </div>

      {showLegend && view !== "table" && (
        <div className="viz-legend">
          {series.map((s) => (
            <span key={s.key} className="viz-legend-item">
              <span className="viz-swatch" style={{ background: seriesColor(series, s.key) }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <div className="chart-panel-body" style={{ padding: view === "table" ? 0 : "0.6rem 0.25rem 0.25rem" }}>
        {children}
      </div>

      {note && <div style={{ padding: "0 1.15rem 0.5rem", fontSize: "var(--t-xs)", color: "var(--amber)", fontWeight: 600 }}>{note}</div>}
      {footer}
      {source && <div className="chart-source">{source}</div>}
    </figure>
  );
}
