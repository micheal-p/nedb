import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireNecal } from "@/lib/necal-access";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { geminiConfigured, geminiGenerate } from "@/lib/gemini";
import { getGeminiUsage, quotaResetISO } from "@/lib/usage";

// POST /api/necal/narrate — the briefing writer.
//
// The planning model is deterministic and stays that way: lib/necal.ts does
// every piece of arithmetic, and this route does none. What AI adds to NECAL
// is words — the model's output turned into the memo a Permanent Secretary
// reads in four minutes, and, when two scenarios are sent, a plain statement
// of what changed between them and what assumption drove the change.
//
// The figures arrive already computed from the client's scenario. That is
// safe precisely because this route only phrases them: a doctored number in
// the request produces a doctored DRAFT on the author's own screen, signed by
// nobody, published nowhere. The draft is labelled as a draft for exactly
// that reason.

const MAX_BODY = 24_000;   // condensed scenarios are ~2-4KB; anything near this is abuse

export async function POST(req: NextRequest) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  if (!geminiConfigured()) return err("Narration not configured — set GEMINI_API_KEY", 503);

  const rl = await checkRateLimitDurable(`necal-narrate:${access.username}`, 20, 3600);
  if (!rl.allowed) return err(`Drafting limit reached — try again in ${Math.ceil(rl.resetIn / 60)} min.`, 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return err("Scenario payload too large.");
  let body: { scenario?: unknown; compare?: unknown } | null = null;
  try { body = JSON.parse(raw); } catch { /* handled below */ }
  if (!body?.scenario) return err("scenario is required");

  const compare = body.compare ? JSON.stringify(body.compare, null, 1) : null;

  const prompt = `You are drafting an internal planning briefing for the Nigeria Energy Data Bank's NECAL2050 scenario tool, read by senior officials at the Energy Commission of Nigeria.

ABSOLUTE RULES:
- Every figure you state must appear verbatim in the JSON below. Do no arithmetic of any kind: no sums, averages, percentages, rounding or unit conversions. If a number you want is not in the JSON, write the sentence without it.
- Describe differences between scenarios in words (higher, lower, earlier, larger) and only quote numbers both JSONs actually contain.
- If the JSON carries warnings or caveats, state them plainly in the final section. Never soften them.
- This is a DRAFT for the scenario author. Do not address the reader as if the plan were adopted policy.

STRUCTURE, with these exact headings:
**What this scenario assumes** — the drivers and mix targets, in two or three sentences a non-engineer follows.
**What it requires** — demand growth, capacity to build, the build rate.
**What it costs and emits** — capital requirement, emissions, clean share.
${compare ? "**What changed against the comparison scenario** — the differences and, from the assumptions, why.\n" : ""}**What this rests on** — the warnings and caveats, stated as the conditions under which the numbers hold.

Length: under 320 words. Register: formal, plain, Nigerian civil service. No dash punctuation, use commas. Do not invent policy recommendations.

SCENARIO JSON:
${JSON.stringify(body.scenario, null, 1)}
${compare ? `\nCOMPARISON SCENARIO JSON:\n${compare}` : ""}`;

  try {
    const draft = await geminiGenerate(prompt);
    if (!draft) return err("No draft generated", 502);
    return ok({
      draft,
      disclaimer: "Machine-drafted from the scenario's computed figures. Verify every number against the report before circulation.",
      usage: { ai: await getGeminiUsage() },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Narration error";
    if (/429/.test(msg)) {
      return Response.json(
        { error: "ai_quota", resetsAt: quotaResetISO(), message: "Today's free AI allowance is used up." },
        { status: 429 }
      );
    }
    return err(msg, 500);
  }
}
