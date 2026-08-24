// ── lib/pena-analysis.ts ────────────────────────────────────────────────────
// Turns a PENA assessment into written findings.
//
// The insights page shows an analyst what the data says. A bulletin has to say
// what it MEANS, in sentences a policy reader can act on. This generates that
// text from the actual aggregates — nothing here is boilerplate that would read
// the same for a different assessment.
//
// Every statement carries the number it rests on, so a reader can check it, and
// nothing is asserted where the sample is too small to support it.

import { K_ANON_MIN, TIERS, TIER_ORDER, type PenaTier } from "@/lib/pena";

export type AnalysisInput = {
  title: string;
  total: number;
  stats: {
    avg_income: number | null;
    median_income: number | null;
    avg_light_hours: number | null;
    avg_energy_expense: number | null;
    avg_burden_pct: number | null;
  };
  tier_distribution: { tier: PenaTier; count: number }[];
  by_state: { name: string; count: number; avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null; tiers: number[] }[];
  energy_sources: { name: string; count: number }[];
};

export type Finding = {
  heading: string;
  body: string;
  /** The figures this finding rests on, shown beneath it. */
  basis: string;
  weight: "headline" | "supporting";
};

const naira = (v: number | null | undefined) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);
const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100);

export function analyse(d: AnalysisInput): { findings: Finding[]; summary: string; caveats: string[] } {
  const findings: Finding[] = [];
  const caveats: string[] = [];
  const n = d.total;

  if (n < K_ANON_MIN) {
    return {
      findings: [],
      summary: `${d.title} has ${n} verified response${n === 1 ? "" : "s"}, below the ${K_ANON_MIN}-response privacy floor. No findings can be published yet.`,
      caveats: [`Statistics publish automatically once ${K_ANON_MIN} verified responses are collected.`],
    };
  }

  // ── 1. Energy poverty: the headline ────────────────────────────────────
  const byTier = new Map(d.tier_distribution.map((t) => [t.tier, t.count]));
  const critical = (byTier.get("D") ?? 0) + (byTier.get("E") ?? 0);
  const secure = (byTier.get("A") ?? 0) + (byTier.get("B") ?? 0);
  const criticalPct = pct(critical, n);
  const securePct = pct(secure, n);

  findings.push({
    heading: criticalPct >= 50
      ? "The majority of respondents are in energy poverty"
      : criticalPct >= 25
        ? "A substantial minority of respondents are in energy poverty"
        : "Most respondents are energy secure or near it",
    body: criticalPct >= 25
      ? `${criticalPct.toFixed(0)}% of respondents fall in tiers D and E, meaning they combine short daily supply with a high share of income spent on energy. ${securePct.toFixed(0)}% sit in tiers A and B. On this evidence, interventions aimed at supply hours alone will not move households out of the lower tiers unless the cost burden moves with them.`
      : `${securePct.toFixed(0)}% of respondents fall in tiers A and B, with ${criticalPct.toFixed(0)}% in tiers D and E. The distribution suggests the binding constraint in this population is not baseline access but reliability and cost at the margin.`,
    basis: `${n} verified responses. Tier mix: ${TIER_ORDER.map((t) => `${t} ${byTier.get(t) ?? 0}`).join(", ")}.`,
    weight: "headline",
  });

  // ── 2. Energy burden ───────────────────────────────────────────────────
  if (d.stats.avg_burden_pct != null) {
    const b = d.stats.avg_burden_pct;
    findings.push({
      heading: b > 10
        ? "Energy costs exceed the international energy-poverty threshold"
        : b > 5
          ? "Energy costs sit above a comfortable share of income"
          : "Energy costs sit within a manageable share of income",
      body: b > 10
        ? `Respondents spend an average of ${b.toFixed(1)}% of monthly income on energy, above the 10% share widely treated internationally as the energy-poverty threshold. Put plainly, roughly one naira in every ${Math.max(2, Math.round(100 / b))} earned goes to keeping the lights on and the cooking done.`
        : `Respondents spend an average of ${b.toFixed(1)}% of monthly income on energy, ${b > 5 ? "above the 5% level generally regarded as comfortable but below the 10% energy-poverty threshold" : "within the 5% level generally regarded as comfortable"}.`,
      basis: `Average monthly energy spend ${naira(d.stats.avg_energy_expense)} against average monthly income ${naira(d.stats.avg_income)}; median income ${naira(d.stats.median_income)}.`,
      weight: "headline",
    });

    // Mean vs median: the distribution question a statistician asks first
    if (d.stats.avg_income != null && d.stats.median_income != null && d.stats.median_income > 0) {
      const skew = ((d.stats.avg_income - d.stats.median_income) / d.stats.median_income) * 100;
      if (Math.abs(skew) > 15) {
        findings.push({
          heading: skew > 0 ? "Average income overstates the typical respondent" : "Income is clustered above the average",
          body: skew > 0
            ? `The mean income of ${naira(d.stats.avg_income)} sits ${skew.toFixed(0)}% above the median of ${naira(d.stats.median_income)}, so a minority of higher earners is pulling the average up. Any targeting or affordability threshold set off the average will therefore be set too high for the typical household in this sample.`
            : `The mean income of ${naira(d.stats.avg_income)} sits below the median of ${naira(d.stats.median_income)}, indicating a cluster of lower earners at the bottom of the distribution.`,
          basis: `Mean ${naira(d.stats.avg_income)} against median ${naira(d.stats.median_income)}, ${n} responses.`,
          weight: "supporting",
        });
      }
    }
  }

  // ── 3. Supply hours ────────────────────────────────────────────────────
  if (d.stats.avg_light_hours != null) {
    const h = d.stats.avg_light_hours;
    findings.push({
      heading: h < 8 ? "Daily supply is severely short" : h < 16 ? "Daily supply is partial" : "Daily supply is broadly adequate",
      body: `Respondents report an average of ${h.toFixed(1)} hours of electricity supply per day, ${(24 - h).toFixed(1)} hours short of continuous supply. ${
        h < 8
          ? "At this level households are running on self-generation or going without for most of the day, which is what drives the cost burden above."
          : h < 16
            ? "This is enough for evening use but not for productive daytime activity, which is the level at which supply starts to constrain income rather than only comfort."
            : "At this level supply is rarely the binding constraint; cost and connection quality matter more."
      }`,
      basis: `Average ${h.toFixed(1)} hours per day across ${n} responses.`,
      weight: "headline",
    });
  }

  // ── 4. Geography ───────────────────────────────────────────────────────
  const states = d.by_state.filter((s) => s.count >= K_ANON_MIN);
  if (states.length >= 2) {
    const byBurden = [...states]
      .filter((s) => s.avg_income && s.avg_energy_expense)
      .map((s) => ({ name: s.name, burden: pct(s.avg_energy_expense!, s.avg_income!), count: s.count }))
      .sort((a, b) => b.burden - a.burden);

    if (byBurden.length >= 2) {
      const worst = byBurden[0];
      const best = byBurden[byBurden.length - 1];
      findings.push({
        heading: `Energy burden varies widely between states`,
        body: `${worst.name} carries the heaviest burden in this sample at ${worst.burden.toFixed(1)}% of income, against ${best.burden.toFixed(1)}% in ${best.name} — a gap of ${(worst.burden - best.burden).toFixed(1)} percentage points. A national average conceals this: an intervention sized on the national figure would be too small where it is needed most.`,
        basis: `${states.length} states above the ${K_ANON_MIN}-response reporting floor. ${worst.name} ${worst.count} responses, ${best.name} ${best.count} responses.`,
        weight: "headline",
      });
    }

    const lowest = [...states].filter((s) => s.avg_light_hours != null).sort((a, b) => a.avg_light_hours! - b.avg_light_hours!)[0];
    if (lowest) {
      findings.push({
        heading: `Supply is shortest in ${lowest.name}`,
        body: `${lowest.name} reports the shortest daily supply in this sample at ${lowest.avg_light_hours!.toFixed(1)} hours. On the tier method used here, short supply and high burden compound, so states at the bottom of both measures are where tier D and E concentrations are highest.`,
        basis: `${lowest.count} responses from ${lowest.name}.`,
        weight: "supporting",
      });
    }
  } else {
    caveats.push(`Only ${states.length} state${states.length === 1 ? "" : "s"} reached the ${K_ANON_MIN}-response floor, so no geographic comparison is published.`);
  }

  // ── 5. Fuel stack ──────────────────────────────────────────────────────
  if (d.energy_sources.length) {
    const top = d.energy_sources[0];
    const topPct = pct(top.count, n);
    findings.push({
      heading: `${top.name} is the primary energy source for ${topPct.toFixed(0)}% of respondents`,
      body: `${top.name} leads the reported fuel stack${d.energy_sources[1] ? `, followed by ${d.energy_sources[1].name} at ${pct(d.energy_sources[1].count, n).toFixed(0)}%` : ""}. Where the primary source is a self-generated or traditional fuel, the cost burden above is largely a fuel cost rather than a tariff, which changes what policy can move it.`,
      basis: d.energy_sources.slice(0, 4).map((s) => `${s.name} ${s.count}`).join(", ") + `, of ${n} responses.`,
      weight: "supporting",
    });
  }

  // ── Standing caveats ───────────────────────────────────────────────────
  caveats.push("This is a field-collected sample of respondents who completed the assessment. It is not a nationally representative survey, and the findings describe the respondents, not the country.");
  caveats.push(`Any state or local government area with fewer than ${K_ANON_MIN} responses is withheld from published breakdowns under the NDPA 2023 privacy floor.`);
  caveats.push("Incomes and energy spending are self-reported and unaudited.");

  const headline = findings.find((f) => f.weight === "headline");
  const summary = `${d.title}: ${n} verified responses. ${headline ? headline.heading + "." : ""} Average supply ${d.stats.avg_light_hours?.toFixed(1) ?? "—"} hours a day, average energy burden ${d.stats.avg_burden_pct?.toFixed(1) ?? "—"}% of income, median income ${naira(d.stats.median_income)}.`;

  return { findings, summary, caveats };
}

/** Tier label helper for the report renderer. */
export function tierLabel(t: PenaTier): string {
  return `${t} — ${TIERS[t].label}`;
}
