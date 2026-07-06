// ── lib/signals.ts ──────────────────────────────────────────────────────────
// Pure signal engine, shared by the series page and the daily alert cron.
// Applies a series' signal_rules JSONB to its national rows (ascending) and
// returns the level + rendered sentence.

export interface SignalRules {
  compare_to: string;
  threshold_warn: number;
  threshold_critical: number;
  direction: string;
  templates: Record<string, string>;
  unit_label?: string;
}

export type SignalLevel = "above" | "neutral" | "warn" | "critical";

export interface Signal { text: string; level: SignalLevel; pct: number }

export function computeSignal(
  rules: SignalRules,
  rowsAsc: { value: number | null }[]
): Signal | null {
  const vals = rowsAsc.map((r) => r.value).filter((v): v is number => v !== null);
  if (vals.length < 2) return null;

  const desc = [...vals].reverse();
  const latest = desc[0];
  const refCount = rules.compare_to === "prev_period" ? 1 : Math.min(60, desc.length - 1);
  const refVals = desc.slice(1, refCount + 1);
  if (!refVals.length) return null;

  const ref = refVals.reduce((a, b) => a + b, 0) / refVals.length;
  if (ref === 0) return null;

  const pct = ((latest - ref) / Math.abs(ref)) * 100;
  const isHigherBetter = rules.direction !== "lower_is_better";
  const effectivePct = isHigherBetter ? pct : -pct;

  let level: SignalLevel = "neutral";
  if (effectivePct <= rules.threshold_critical) level = "critical";
  else if (effectivePct <= rules.threshold_warn) level = "warn";
  else if (effectivePct > 5) level = "above";

  const text = (rules.templates?.[level] ?? "").replace(/{pct}/g, Math.abs(pct).toFixed(1));
  return { text, level, pct };
}
