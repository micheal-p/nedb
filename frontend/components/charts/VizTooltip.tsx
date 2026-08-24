"use client";

// ── VizTooltip ──────────────────────────────────────────────────────────────
// One tooltip for every chart. Full precision here — axes may abbreviate, but
// the figure a reader will quote must be exact. Values wear text tokens with a
// colour chip beside them; the number itself is never coloured, so it stays
// readable and identity stays on the chip.

import { fmtFull } from "@/lib/viz";

type Entry = { name?: string; value?: number | string; color?: string; dataKey?: string };

export default function VizTooltip({
  active, payload, label, unit, labelPrefix,
}: {
  active?: boolean;
  payload?: Entry[];
  label?: string | number;
  unit?: string;
  labelPrefix?: string;
}) {
  if (!active || !payload?.length) return null;

  const rows = payload.filter((p) => p.value !== undefined && p.value !== null);
  if (!rows.length) return null;

  return (
    <div className="viz-tip" role="tooltip">
      <div className="viz-tip-head">{labelPrefix ? `${labelPrefix} ` : ""}{label}</div>
      <table className="viz-tip-table">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="viz-tip-name">
                <span className="viz-tip-chip" style={{ background: r.color ?? "var(--ink-4)" }} aria-hidden />
                {r.name ?? r.dataKey}
              </td>
              <td className="viz-tip-val">
                {typeof r.value === "number" ? fmtFull(r.value, unit) : String(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
