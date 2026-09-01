import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { requireNecal } from "@/lib/necal-access";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { geminiConfigured, geminiGenerate } from "@/lib/gemini";
import { buildBriefingPrompt, MAX_NARRATE_BODY } from "@/lib/necal-narrate";
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



export async function POST(req: NextRequest) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  if (!geminiConfigured()) return err("Narration not configured — set GEMINI_API_KEY", 503);

  const rl = await checkRateLimitDurable(`necal-narrate:${access.username}`, 20, 3600);
  if (!rl.allowed) return err(`Drafting limit reached — try again in ${Math.ceil(rl.resetIn / 60)} min.`, 429);

  const raw = await req.text();
  if (raw.length > MAX_NARRATE_BODY) return err("Scenario payload too large.");
  let body: { scenario?: unknown; compare?: unknown } | null = null;
  try { body = JSON.parse(raw); } catch { /* handled below */ }
  if (!body?.scenario) return err("scenario is required");

  const prompt = buildBriefingPrompt(body.scenario, body.compare ?? null);

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
