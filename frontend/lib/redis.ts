import { Redis } from "@upstash/redis";

let _client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!_client) {
    _client = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try { return await getRedis()?.get<T>(key) ?? null; }
  catch { return null; }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
  try { await getRedis()?.set(key, value, { ex: ttlSeconds }); }
  catch { /* cache failures must never break the main response */ }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  const r = getRedis(); if (!r) return;
  try { await r.del(...keys); }
  catch { /* non-fatal */ }
}
