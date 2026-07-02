// Simple in-process sliding-window rate limiter.
// Works for single-instance Vercel deployments (each function is isolated,
// but login attempts within the same cold-start window are tracked).
// Swap for Upstash @upstash/ratelimit when Redis is configured.

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
