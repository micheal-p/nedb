// ── lib/necal-narrate.ts ────────────────────────────────────────────────────
// The briefing prompt, shared by the narrate route and the planning-folder
// save (a saved plan file carries its memo). One home, so the words-only
// rules cannot drift between the two callers.

export const MAX_NARRATE_BODY = 24_000;

export function buildBriefingPrompt(scenario: unknown, compare?: unknown | null): string {
  const compareJson = compare ? JSON.stringify(compare, null, 1) : null;
  return `You are drafting an internal planning briefing for the Nigeria Energy Data Bank's NECAL2050 scenario tool, read by senior officials at the Energy Commission of Nigeria.

ABSOLUTE RULES:
- Every figure you state must appear verbatim in the JSON below. Do no arithmetic of any kind: no sums, averages, percentages, rounding or unit conversions. If a number you want is not in the JSON, write the sentence without it.
- Describe differences between scenarios in words (higher, lower, earlier, larger) and only quote numbers both JSONs actually contain.
- If the JSON carries warnings or caveats, state them plainly in the final section. Never soften them.
- This is a DRAFT for the scenario author. Do not address the reader as if the plan were adopted policy.

STRUCTURE, with these exact headings:
**What this scenario assumes** — the drivers and mix targets, in two or three sentences a non-engineer follows.
**What it requires** — demand growth, capacity to build, the build rate.
**What it costs and emits** — capital requirement, emissions, clean share.
${compareJson ? "**What changed against the comparison scenario** — the differences and, from the assumptions, why.\n" : ""}**What this rests on** — the warnings and caveats, stated as the conditions under which the numbers hold.

Length: under 320 words. Register: formal, plain, Nigerian civil service. No dash punctuation, use commas. Do not invent policy recommendations.

SCENARIO JSON:
${JSON.stringify(scenario, null, 1)}
${compareJson ? `\nCOMPARISON SCENARIO JSON:\n${compareJson}` : ""}`;
}
