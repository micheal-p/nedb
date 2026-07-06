// Rate limiting.
// checkRateLimit          — in-process sliding window (per serverless instance).
// checkRateLimitDurable   — Redis-backed fixed window, keyed however the caller
//                           chooses (typically per IP). Survives redeploys and
//                           applies across all instances; falls back to the
//                           in-process limiter when Redis is unavailable.

import { getRedis } from "@/lib/redis";

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

/** Redis-backed fixed-window limiter — durable across deploys and instances. */
export async function checkRateLimitDurable(
  key: string,
  maxRequests: number,
  windowSec: number
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const r = getRedis();
  if (!r) return checkRateLimit(key, maxRequests, windowSec * 1000);
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
    return checkRateLimit(key, maxRequests, windowSec * 1000);
  }
}
