// ── lib/gemini.ts ───────────────────────────────────────────────────────────
// Thin REST client for Google Gemini (free tier). No SDK — two fetch calls.
// Key-gated: everything returns null/throws cleanly when GEMINI_API_KEY is absent,
// so the assistant degrades to a "not configured" notice instead of crashing.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Embed one text with text-embedding-004 (768 dims). */
export async function geminiEmbed(text: string): Promise<number[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(`${BASE}/gemini-embedding-001:embedContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Gemini embed failed: ${res.status}`);
  const j = await res.json();
  return j?.embedding?.values ?? null;
}

/** Generate an answer with gemini-2.0-flash. */
export async function geminiGenerate(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(`${BASE}/gemini-2.5-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      // thinkingBudget 0: gemini-2.5-flash spends "thinking" tokens from the output
      // budget by default, which truncates answers mid-sentence for RAG use.
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini generate failed: ${res.status}`);
  const j = await res.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}
