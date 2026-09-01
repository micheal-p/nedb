// Rate limiting.
// checkRateLimit          — in-process sliding window (per serverless instance).
// checkRateLimitDurable   — durable fixed window, keyed however the caller
//                           chooses (typically per IP). Three rails, best
//                           available wins:
//                             1. Redis, if UPSTASH_* is ever configured
//                             2. Postgres — our own rail: one atomic upsert
//                                per hit against an UNLOGGED counter table
//                                (migration 063), durable across deploys and
//                                instances with no cache to rent
//                             3. in-process, the last resort that fails safe
//
// The Postgres rail costs one extra database round trip per limited request.
// Every limited endpoint here is low-volume by design, and a counted request
// is worth a round trip; an uncounted one was worth nothing.

import { getRedis } from "@/lib/redis";
import { db } from "@/lib/supabase-server";

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  let win = store.get(key);

  if (!win || now > win.resetAt) {
    win = { count: 0, resetAt: now + windowMs };
    store.set(key, win);
  }

  win.count += 1;
  const remaining = Math.max(0, maxRequests - win.count);
  const resetIn   = Math.ceil((win.resetAt - now) / 1000);

  if (win.count > maxRequests) {
    return { allowed: false, remaining: 0, resetIn };
  }

  // Prune old keys occasionally to prevent memory growth
  if (store.size > 10_000) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k);
    }
  }

  return { allowed: true, remaining, resetIn };
}

/** Postgres rail: floor(epoch/window) buckets, window baked into the key so
 *  differently-windowed limits sharing a name can never collide. */
async function checkRateLimitPg(
  key: string,
  maxRequests: number,
  windowSec: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number } | null> {
  try {
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const { data, error } = await db().rpc("rl_hit", { p_key: `${key}:${windowSec}`, p_bucket: bucket });
    if (error || typeof data !== "number") return null;
    // Hygiene, roughly once in fifty hits: sweep buckets older than an hour.
    if (data % 50 === 7) {
      const before = Math.floor((Date.now() - 3_600_000) / (windowSec * 1000));
      db().rpc("rl_sweep", { p_before: before }).then(() => {}, () => {});
    }
    const resetIn = windowSec - Math.floor((Date.now() / 1000) % windowSec);
    return { allowed: data <= maxRequests, remaining: Math.max(0, maxRequests - data), resetIn };
  } catch {
    return null;
  }
}

/** Durable fixed-window limiter — Redis, else Postgres, else in-process. */
export async function checkRateLimitDurable(
  key: string,
  maxRequests: number,
  windowSec: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const r = getRedis();
  if (!r) {
    const pg = await checkRateLimitPg(key, maxRequests, windowSec);
    return pg ?? checkRateLimit(key, maxRequests, windowSec * 1000);
  }
  try {
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const k = `rl:${key}:${bucket}`;
    const count = await r.incr(k);
    if (count === 1) await r.expire(k, windowSec + 5);
    const resetIn = windowSec - Math.floor((Date.now() / 1000) % windowSec);
    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetIn,
    };
  } catch {
    const pg = await checkRateLimitPg(key, maxRequests, windowSec);
    return pg ?? checkRateLimit(key, maxRequests, windowSec * 1000);
  }
}
