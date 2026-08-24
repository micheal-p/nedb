// ── lib/necal-scenario.ts ───────────────────────────────────────────────────
// One scenario, one derivation, two pages.
//
// The calculator and the printable report used to run the model independently:
// the calculator applied your drivers, your policy instruments, your mix and
// your economic assumptions, and the report ran a stock preset. So the report
// carried a different demand, a different build and a different capital
// requirement from the screen it was generated off, under the same title. That
// is the most dangerous kind of bug in a planning tool, because the printed
// version is the one that gets circulated.
//
// Everything the model needs to reproduce a run lives in `Scenario`, and
// `deriveScenario` is the only place the chain is computed. Both pages call it.

import {
  runPlan, normaliseMix, PRESETS, DEFAULT_DRIVERS, DEFAULT_MIX,
  type PlanningDrivers, type MixTargets, type PlanBase, type PlanResult,
} from "@/lib/necal";
import {
  applyInstruments, economics, assessCommitments, DEFAULT_ECONOMICS,
  type PolicyMix, type EconomicAssumptions,
} from "@/lib/necal-policy";

/** Everything needed to reproduce a run, and nothing that can be recomputed. */
export type Scenario = {
  /** Schema version, so an old link is refused rather than misread. */
  v: 1;
  /** What the planner called this run. Carried onto the report cover. */
  name: string;
  presetId: string;
  drivers: PlanningDrivers;
  mix: MixTargets;
  policy: PolicyMix;
  econ: EconomicAssumptions;
  /** Sector targets. A goal with no target is absent, never zero. */
  goals: Record<string, number>;
};

export const DEFAULT_SCENARIO: Scenario = {
  v: 1,
  name: "Untitled scenario",
  presetId: "access",
  drivers: DEFAULT_DRIVERS,
  mix: DEFAULT_MIX,
  policy: {},
  econ: DEFAULT_ECONOMICS,
  goals: { clean_share: 60, access: 100, losses: 8 },
};

/**
 * The clean-share boost from policy moves capacity out of the emitting slots
 * proportionally rather than conjuring it. Works entirely on normalised shares:
 * mixing raw slider values with percentages silently reweights whichever slot
 * the arithmetic does not touch.
 */
export function effectiveMixFor(normMix: MixTargets, cleanBoost: number): MixTargets {
  if (cleanBoost <= 0) return normMix;
  const emitting = normMix.gas + normMix.oil + normMix.other;
  if (emitting <= 0) return normMix;
  const take = Math.min(cleanBoost, emitting * 0.9);
  return {
    hydro: normMix.hydro,
    gas:   Math.max(0, normMix.gas   - take * (normMix.gas / emitting)),
    oil:   Math.max(0, normMix.oil   - take * (normMix.oil / emitting)),
    other: Math.max(0, normMix.other - take * (normMix.other / emitting)),
    solar: normMix.solar + take * 0.7,
    wind:  normMix.wind  + take * 0.3,
  };
}

export type DerivedScenario = ReturnType<typeof deriveScenario>;

/** Run the whole chain: policy → mix → plan → economics → commitments. */
export function deriveScenario(s: Scenario, base: PlanBase) {
  const normMix = normaliseMix(s.mix);
  const cleanTargetPct = normMix.hydro + normMix.solar + normMix.wind;
  const applied = applyInstruments(s.drivers, s.policy, cleanTargetPct);
  const effectiveMix = effectiveMixFor(normMix, applied.cleanBoost);

  const plan: PlanResult = runPlan(applied.drivers, effectiveMix, base);

  // The same model on the current-trajectory pathway, holding the anchor and
  // horizon fixed so the comparison is like for like.
  const current = PRESETS.find((p) => p.id === "current");
  const counterfactual = runPlan(
    {
      ...DEFAULT_DRIVERS,
      baseYear: s.drivers.baseYear,
      horizon: s.drivers.horizon,
      tdLossPct: s.drivers.tdLossPct,
      ...(current?.drivers ?? {}),
    },
    current?.mix ?? DEFAULT_MIX,
    base
  );

  const econResult = economics(plan, s.econ, applied.capexMultiplier, applied.carbonPriceUsd);
  const commitments = assessCommitments(plan, counterfactual);

  return {
    normMix,
    applied,
    effectiveMix,
    shownMix: normaliseMix(effectiveMix),
    plan,
    counterfactual,
    econResult,
    commitments,
  };
}

// ── Carrying a scenario between pages ──────────────────────────────────────
// Base64url of the JSON, in the query string. It travels with the link, so a
// report someone was sent reproduces the run they were shown, and a stale link
// with an unknown version is refused rather than silently reinterpreted.

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeScenario(s: Scenario): string {
  return toBase64Url(JSON.stringify(s));
}

/** Returns null for anything malformed or from a version this build cannot read. */
export function decodeScenario(encoded: string | null | undefined): Scenario | null {
  if (!encoded) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Partial<Scenario>;
    if (parsed?.v !== 1 || !parsed.drivers || !parsed.mix) return null;
    return {
      v: 1,
      name: String(parsed.name ?? "Untitled scenario").slice(0, 120),
      presetId: String(parsed.presetId ?? "custom"),
      drivers: { ...DEFAULT_DRIVERS, ...parsed.drivers },
      mix: { ...DEFAULT_MIX, ...parsed.mix },
      policy: parsed.policy ?? {},
      econ: { ...DEFAULT_ECONOMICS, ...(parsed.econ ?? {}) },
      goals: parsed.goals ?? {},
    };
  } catch {
    return null;
  }
}
