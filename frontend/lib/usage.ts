// ── lib/usage.ts ────────────────────────────────────────────────────────────
// Self-metered Gemini usage. Google exposes no "quota remaining" API, so we
// count our own calls per (Pacific) day in Redis and compare against the
// published free-tier daily caps. Approximate by design — but honest: the
// meter reflects exactly what this deployment has consumed.

import { getRedis } from "@/lib/redis";

// Published free-tier daily request caps (approximate; update if Google changes them)
export const LIMITS = {
  gen: 250,     // gemini-2.5-flash requests/day
  embed: 1000,  // gemini-embedding-001 requests/day
};

/** Google free-tier quotas reset at midnight America/Los_Angeles. */
export function quotaResetISO(): string {
  const now = new Date();
  const la = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const offset = now.getTime() - la.getTime();
  const next = new Date(la);
  next.setHours(24, 0, 0, 0);
  return new Date(next.getTime() + offset).toISOString();
}

function dayKey(kind: "gen" | "embed"): string {
  // key by the Pacific date so the counter rolls over exactly when the quota does
  const laDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const d = `${laDate.getFullYear()}-${String(laDate.getMonth() + 1).padStart(2, "0")}-${String(laDate.getDate()).padStart(2, "0")}`;
  return `gemini:${kind}:${d}`;
}

/** Count one Gemini call. Fire-and-forget — metering must never break a request. */
export async function bumpGeminiUsage(kind: "gen" | "embed"): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    const k = dayKey(kind);
    const n = await r.incr(k);
    if (n === 1) await r.expire(k, 60 * 60 * 48);
  } catch { /* non-fatal */ }
}

export interface AiUsage {
  used: number;
  limit: number;
  pct: number;          // 0–100
  resetsAt: string;     // ISO — midnight Pacific
}

function pacificDateOffset(daysAgo: number): string {
  const la = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  la.setDate(la.getDate() - daysAgo);
  return `${la.getFullYear()}-${String(la.getMonth() + 1).padStart(2, "0")}-${String(la.getDate()).padStart(2, "0")}`;
}

export interface UsageDay { date: string; gen: number; embed: number }

/** Last N days of self-metered Gemini calls (today first). */
export async function getUsageHistory(days = 7): Promise<UsageDay[]> {
  const out: UsageDay[] = [];
  try {
    const r = getRedis();
    for (let i = 0; i < days; i++) {
      const date = pacificDateOffset(i);
      const [gen, embed] = r
        ? await Promise.all([r.get(`gemini:gen:${date}`), r.get(`gemini:embed:${date}`)])
        : [0, 0];
      out.push({ date, gen: Number(gen ?? 0), embed: Number(embed ?? 0) });
    }
  } catch { /* degrade to zeros */ }
  return out;
}

export async function getGeminiUsage(): Promise<AiUsage> {
  let used = 0;
  try {
    const r = getRedis();
    if (r) used = Number((await r.get(dayKey("gen"))) ?? 0);
  } catch { /* meter degrades to 0, never throws */ }
  return {
    used,
    limit: LIMITS.gen,
    pct: Math.min(100, Math.round((used / LIMITS.gen) * 100)),
    resetsAt: quotaResetISO(),
  };
}
