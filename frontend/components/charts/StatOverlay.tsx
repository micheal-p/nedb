"use client";

// ── StatOverlay.tsx ─────────────────────────────────────────────────────────
// ONE reusable analytical chart. The parent passes a discriminated `spec` that
// says which analytical shape to render (change bars, dual line, cumulative area,
// indexed growth, volatility band, trend decomposition). Keeping every analytical
// shape in a single component means the StatisticalAnalysisPanel just maps specs —
// no per-overlay chart files to maintain.

import { fmtCompact } from "@/lib/format";
import {
  ComposedChart, Line, Area, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ChangePoint, ValuePoint, BandPoint, DecompPoint } from "@/lib/analytics";

const POS = "#0E7A3C";
const NEG = "#C0392B";
const BLUE = "#1D4ED8";
const AMBER = "#B45309";
const INK5 = "#8E867B";
const BORDER = "#E7E5E0";

export type OverlaySpec =
  | { kind: "change"; data: ChangePoint[] }
  | { kind: "rolling"; data: { period: string; actual: number; smoothed: number | null }[]; window: number }
  | { kind: "cumulative"; data: ValuePoint[] }
  | { kind: "indexed"; data: ValuePoint[]; base: number }
  | { kind: "band"; data: BandPoint[] }
  | { kind: "decomp"; data: DecompPoint[] };

interface Props {
  spec: OverlaySpec;
  unit: string;
  height?: number;
}

const axisX = (
  <XAxis dataKey="period" tick={{ fontSize: 10, fill: INK5 }} axisLine={{ stroke: BORDER }} tickLine={false} interval="preserveStartEnd" />
);
const grid = <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />;

function pctTooltip() {
  return (
    <Tooltip
      contentStyle={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }}
      formatter={(v: unknown, name: unknown) => {
        const num = Number(v);
        if (name === "pct") return [`${num >= 0 ? "+" : ""}${num.toFixed(1)}%`, "Change"];
        return [num.toLocaleString(undefined, { maximumFractionDigits: 2 }), String(name)];
      }}
    />
  );
}

export default function StatOverlay({ spec, unit, height = 240 }: Props) {
  if (!spec.data.length) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: INK5, fontSize: "0.78rem" }}>
        Not enough data for this analysis
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderByKind(spec, unit)}
    </ResponsiveContainer>
  );
}

function renderByKind(spec: OverlaySpec, unit: string) {
  switch (spec.kind) {
    // ── % change bars, green up / red down ──
    case "change":
      return (
        <ComposedChart data={spec.data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          {grid}{axisX}
          <YAxis tick={{ fontSize: 10, fill: INK5 }} width={44} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
          <ReferenceLine y={0} stroke={INK5} strokeWidth={1} />
          {pctTooltip()}
          <Bar dataKey="pct" name="pct" radius={[2, 2, 0, 0]} maxBarSize={34}>
            {spec.data.map((d, i) => <Cell key={i} fill={d.pct >= 0 ? POS : NEG} />)}
          </Bar>
        </ComposedChart>
      );

    // ── actual line + smoothed rolling-mean line ──
    case "rolling":
      return (
        <ComposedChart data={spec.data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          {grid}{axisX}
          <YAxis tick={{ fontSize: 10, fill: INK5 }} width={48} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
          <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })} />
          <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
          <Line type="monotone" dataKey="actual" name="Actual" stroke={INK5} strokeWidth={1.5} dot={false} opacity={0.55} />
          <Line type="monotone" dataKey="smoothed" name={`${spec.window}-period average`} stroke={BLUE} strokeWidth={2.5} dot={false} connectNulls />
        </ComposedChart>
      );

    // ── cumulative area ──
    case "cumulative":
      return (
        <ComposedChart data={spec.data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={POS} stopOpacity={0.22} />
              <stop offset="95%" stopColor={POS} stopOpacity={0} />
            </linearGradient>
          </defs>
          {grid}{axisX}
          <YAxis tick={{ fontSize: 10, fill: INK5 }} width={48} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
          <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`${Number(v).toLocaleString()} ${unit}`, "Cumulative"]} />
          <Area type="monotone" dataKey="value" name="Cumulative" stroke={POS} strokeWidth={2} fill="url(#cumGrad)" dot={false} />
        </ComposedChart>
      );

    // ── indexed to base=100 with reference line ──
    case "indexed":
      return (
        <ComposedChart data={spec.data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          {grid}{axisX}
          <YAxis tick={{ fontSize: 10, fill: INK5 }} width={44} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toFixed(0)} />
          <ReferenceLine y={spec.base} stroke={AMBER} strokeDasharray="4 4" label={{ value: `Base ${spec.base}`, fontSize: 10, fill: AMBER, position: "insideTopRight" }} />
          <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [`${Number(v).toFixed(1)}`, `Index (base ${spec.base})`]} />
          <Line type="monotone" dataKey="value" name="Index" stroke={BLUE} strokeWidth={2.5} dot={false} />
        </ComposedChart>
      );

    // ── volatility band: shaded mean±kσ + actual line ──
    case "band":
      return (
        <ComposedChart data={spec.data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} stopOpacity={0.12} />
              <stop offset="100%" stopColor={BLUE} stopOpacity={0.12} />
            </linearGradient>
          </defs>
          {grid}{axisX}
          <YAxis tick={{ fontSize: 10, fill: INK5 }} width={48} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
          <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} formatter={(v: unknown, name: unknown) => [Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 }), String(name)]} />
          <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
          {/* lower as transparent base, then upper-lower as filled band */}
          <Area type="monotone" dataKey="lower" name="Lower band" stroke="none" fill="transparent" stackId="band" legendType="none" />
          <Area type="monotone" dataKey="bandWidth" name="Normal range (±2σ)" stroke="none" fill="url(#bandGrad)" stackId="band" />
          <Line type="monotone" dataKey="mean" name="Rolling mean" stroke={BLUE} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Line type="monotone" dataKey="value" name="Actual" stroke={POS} strokeWidth={2.5} dot={false} />
        </ComposedChart>
      );

    // ── trend decomposition: actual + OLS trend line ──
    case "decomp":
      return (
        <ComposedChart data={spec.data} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
          {grid}{axisX}
          <YAxis tick={{ fontSize: 10, fill: INK5 }} width={48} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
          <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12 }} formatter={(v: unknown, name: unknown) => [Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 }), String(name)]} />
          <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
          <Bar dataKey="residual" name="Residual (noise)" maxBarSize={20}>
            {spec.data.map((d, i) => <Cell key={i} fill={d.residual >= 0 ? "rgba(14,122,60,0.35)" : "rgba(192,57,43,0.35)"} />)}
          </Bar>
          <Line type="monotone" dataKey="value" name="Actual" stroke={INK5} strokeWidth={1.5} dot={false} opacity={0.6} />
          <Line type="monotone" dataKey="trend" name="Underlying trend" stroke={AMBER} strokeWidth={2.5} dot={false} />
        </ComposedChart>
      );
  }
}
