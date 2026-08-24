// ── lib/viz.ts ──────────────────────────────────────────────────────────────
// The chart system.
//
// Colour here is not taste, it is validated. The categorical order below was
// checked with the data-viz validator against the light chart surface:
//
//   6 slots, adjacent pairs — lightness band PASS, chroma floor PASS,
//   CVD separation PASS (worst adjacent ΔE 12.6 deutan), normal-vision floor
//   PASS (ΔE 21.1), contrast vs surface PASS (all ≥ 3:1).
//
//   The first FOUR slots additionally pass the stricter all-pairs check
//   (worst ΔE 7.4 protan, in the 6–8 band, which is legal only with secondary
//   encoding — so every chart also carries a legend and direct labels).
//
// Rules that hold everywhere:
//   • Hues are assigned in fixed order and never cycled. A 7th series folds
//     into "Other" or becomes a small multiple; it never gets a generated hue.
//   • Colour follows the entity, never its rank, so filtering a series out
//     does not repaint the survivors.
//   • Never two y-axes. Two measures of different scale become two charts or
//     get indexed to a common base.
//   • Status colours are reserved for state and never reused as "series 5".

export const SERIES_COLORS = [
  "#0E7A3C", // 1 · ECN green — the brand hue leads
  "#1B4FD8", // 2 · blue
  "#C2410C", // 3 · orange
  "#8B5CF6", // 4 · violet
  "#0891B2", // 5 · teal
  "#BE185D", // 6 · magenta
] as const;

/** Beyond this, fold into "Other" or facet — never invent a hue. */
export const MAX_SERIES = SERIES_COLORS.length;

/** Slots 1–4 are safe when every series is on screen at once. */
export const SAFE_SIMULTANEOUS = 4;

/**
 * Stable colour for a named entity.
 * Keyed on the entity so a filter that removes one series never repaints the
 * rest — the single most common way a dashboard misleads.
 */
export function colorFor(entity: string, order: readonly string[]): string {
  const i = order.indexOf(entity);
  return i >= 0 && i < SERIES_COLORS.length ? SERIES_COLORS[i] : NEUTRAL;
}

/** Anything past the palette, and any "Other" bucket. */
export const NEUTRAL = "#6B7280";

// ── Sequential: magnitude. One hue, light to dark, never a rainbow ─────────
export const SEQUENTIAL_GREEN = ["#EAF3EE", "#C4DDD0", "#93C3AC", "#5CA383", "#2A8757", "#0A5C2D"] as const;
export const SEQUENTIAL_BLUE  = ["#E8EEFC", "#C6D5F6", "#94B0EE", "#5C85E4", "#2C5FD8", "#1A3F94"] as const;

// ── Diverging: polarity. Two hues with a NEUTRAL midpoint, never a hue ─────
export const DIVERGING = ["#9A3412", "#C2410C", "#E8A87C", "#E8E8E8", "#7FB398", "#2A8757", "#0A5C2D"] as const;

// ── Status: reserved for state, never for identity ─────────────────────────
export const STATUS = {
  good:     "#0E7A3C",
  warning:  "#96620A",
  serious:  "#C2410C",
  critical: "#B3261E",
  neutral:  "#6B7280",
} as const;

/** Recessive chart furniture — grid and axes must never compete with data. */
export const AXIS = {
  grid:  "#E4E8EA",
  tick:  "#667179",
  label: "#434B51",
} as const;

/** Shared Recharts axis props so every chart looks like the same system. */
export const axisProps = {
  tick: { fontSize: 11, fill: AXIS.tick },
  axisLine: false,
  tickLine: false,
} as const;

/**
 * Compact numeric formatting for axes.
 * Full figures on tooltips and tables; abbreviations only where space forces
 * it, and never in a way that hides the magnitude.
 */
export function fmtAxis(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}bn`;
  if (a >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}m`;
  if (a >= 1_000)         return `${(v / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  if (a > 0 && a < 1)     return v.toFixed(2);
  return String(Math.round(v));
}

/** Full precision, for tooltips, tables and any figure that will be quoted. */
export function fmtFull(v: number | null | undefined, unit?: string): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = Math.abs(v) < 10 && !Number.isInteger(v) ? v.toFixed(2) : Math.round(v).toLocaleString("en-NG");
  return unit ? `${s} ${unit}` : s;
}

/** Signed change with a marker, so direction never rests on colour alone. */
export function fmtChange(pct: number | null): { text: string; tone: "up" | "down" | "flat" } {
  if (pct == null || !Number.isFinite(pct)) return { text: "—", tone: "flat" };
  if (Math.abs(pct) < 0.05) return { text: "no change", tone: "flat" };
  return {
    text: `${pct >= 0 ? "▲ +" : "▼ −"}${Math.abs(pct).toFixed(1)}%`,
    tone: pct >= 0 ? "up" : "down",
  };
}

/** Bucket a value onto a sequential ramp. */
export function rampColor(value: number, min: number, max: number, ramp: readonly string[] = SEQUENTIAL_GREEN): string {
  if (!Number.isFinite(value) || max <= min) return ramp[Math.floor(ramp.length / 2)];
  const t = (value - min) / (max - min);
  return ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(t * (ramp.length - 1))))];
}
