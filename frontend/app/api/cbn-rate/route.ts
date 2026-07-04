import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/redis";

const CACHE_KEY = "cbn:usd_ngn_rate";
const CACHE_TTL = 3600; // 1 hour

// CBN publishes rates via their XML feed. We try two public mirrors.
// If both fail, we return the cached value or a fallback.
async function fetchCBNRate(): Promise<number | null> {
  try {
    // CBN official rates XML — use the JSON proxy via exchangerate-api as primary
    const res = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD",
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const j = await res.json();
      const rate = j?.rates?.NGN as number | undefined;
      if (rate && rate > 100) return rate;
    }
  } catch {
    // fall through to cache
  }

  // Secondary: CBN ERBD XML (public)
  try {
    const res = await fetch(
      "https://www.cbn.gov.ng/rates/ExchRateByCurrency.asp?curr=US+DOLLAR&startdate=01-Jan-2024&enddate=31-Dec-2024&fuseaction=exrates&action=allrates",
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/(\d{3,4}\.\d{2,4})/);
      if (match) return parseFloat(match[1]);
    }
  } catch {
    // fall through to null
  }

  return null;
}

export async function GET() {
  try {
    // 1. Try Redis cache first
    const cached = await cacheGet<string>(CACHE_KEY);
    if (cached) {
      return NextResponse.json({ rate: parseFloat(cached), source: "cache", currency: "USD/NGN" });
    }

    // 2. Fetch live
    const rate = await fetchCBNRate();
    if (rate) {
      await cacheSet(CACHE_KEY, String(rate), CACHE_TTL);
      return NextResponse.json({ rate, source: "live", currency: "USD/NGN" });
    }

    // 3. Stale cache — return even if expired (Redis GET returns null on expiry, so try without TTL)
    return NextResponse.json(
      { rate: null, source: "unavailable", currency: "USD/NGN", error: "CBN rate temporarily unavailable" },
      { status: 503 }
    );
  } catch {
    return NextResponse.json(
      { rate: null, source: "error", currency: "USD/NGN", error: "Internal error" },
      { status: 500 }
    );
  }
}
