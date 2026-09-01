// ── lib/epi.ts ──────────────────────────────────────────────────────────────
// The NEDB Energy Poverty Index: the share of classifiable respondents in
// tiers D and E, per wave of a linked assessment family. One wave is a
// snapshot; two waves of the same population is a measurement of change,
// which is the only thing that proves an intervention worked. The index
// therefore publishes movement only when a second wave clears the privacy
// floor, and says "collecting" until then instead of inventing a trend.

import { db } from "@/lib/supabase-server";
import { K_ANON_MIN } from "@/lib/pena";

export type EpiWave = {
  form_id: number;
  wave: number;
  title: string;
  n_classified: number;
  epi_pct: number | null;      // D+E share of classified, null below the floor
};

export type EpiFamily = {
  root_id: number;
  title: string;
  target_population: string | null;
  waves: EpiWave[];
  movement_pp: number | null;  // latest minus first, percentage points
};

export async function buildEpi(): Promise<{ families: EpiFamily[]; publishable: boolean }> {
  const { data: forms } = await db()
    .from("pena_forms")
    .select("id, title, wave, parent_form_id, is_public_stats, status, target_population")
    .neq("status", "draft")
    .eq("is_public_stats", true);

  const families = new Map<number, { title: string; target_population: string | null; forms: { id: number; wave: number; title: string }[] }>();
  for (const f of forms ?? []) {
    const root = f.parent_form_id ?? f.id;
    if (!families.has(root)) families.set(root, { title: f.title.replace(/ — Wave \d+$/, ""), target_population: f.target_population, forms: [] });
    families.get(root)!.forms.push({ id: f.id, wave: f.wave ?? 1, title: f.title });
  }

  const out: EpiFamily[] = [];
  for (const [rootId, fam] of families) {
    const waves: EpiWave[] = [];
    for (const f of fam.forms.sort((a, b) => a.wave - b.wave)) {
      const { data: tiers } = await db()
        .from("pena_responses")
        .select("tier")
        .eq("form_id", f.id)
        .eq("verify_status", "verified")
        .not("tier", "is", null);
      const n = (tiers ?? []).length;
      const de = (tiers ?? []).filter((t) => t.tier === "D" || t.tier === "E").length;
      waves.push({
        form_id: f.id, wave: f.wave, title: f.title,
        n_classified: n,
        epi_pct: n >= K_ANON_MIN ? Math.round((de / n) * 1000) / 10 : null,
      });
    }
    const published = waves.filter((w) => w.epi_pct != null);
    out.push({
      root_id: rootId,
      title: fam.title,
      target_population: fam.target_population,
      waves,
      movement_pp: published.length >= 2
        ? Math.round((published[published.length - 1].epi_pct! - published[0].epi_pct!) * 10) / 10
        : null,
    });
  }

  return { families: out, publishable: out.some((f) => f.movement_pp != null) };
}
