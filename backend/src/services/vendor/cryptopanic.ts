// src/services/vendor/cryptopanic.ts
import axios from "axios";

const CRYPTOPANIC_BASE = process.env.CRYPTOPANIC_BASE || "https://cryptopanic.com/api/v1";
const CRYPTOPANIC_TOKEN = process.env.CRYPTOPANIC_TOKEN; // put your token in backend/.env

export type CryptoPanicItem = {
  title: string;
  url: string;
  source: { title: string; domain: string };
  published_at: string;
  currencies?: { code: string }[];
};

// ------ simple in-memory cache (24h) ------
const DAY_MS = 24 * 60 * 60 * 1000;
type CacheVal = { data: CryptoPanicItem[]; exp: number };
const cache = new Map<string, CacheVal>();
const put = (k: string, data: CryptoPanicItem[], ttlMs = DAY_MS) =>
  cache.set(k, { data, exp: Date.now() + ttlMs });
const get = (k: string) => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) {
    cache.delete(k);
    return null;
  }
  return v.data;
};

// single-flight guard to avoid duplicate fetches at boundary
let inflight: Promise<CryptoPanicItem[]> | null = null;

/**
 * Fetches "rising" public news once per 24h (global), then returns cached items.
 * We do NOT pass "currencies" to keep a single request for all users.
 * The caller can filter by assets locally.
 */
export async function getDailyNews(limit = 60): Promise<CryptoPanicItem[]> {
  // If you really must have a token-less fallback, just return [] when missing
  if (!CRYPTOPANIC_TOKEN) {
    console.warn("[cryptopanic] CRYPTOPANIC_TOKEN missing – skipping external call");
    return [];
  }

  // Daily cache key; you can add the date for clarity (optional)
  const key = `cp:news:global`;
  const cached = get(key);
  if (cached) return cached;

  // Avoid duplicate calls if multiple requests arrive simultaneously
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const url = `${CRYPTOPANIC_BASE}/posts/`;
      const params: any = {
        kind: "news",
        filter: "rising",
        public: "true",
        limit: Math.min(Math.max(limit, 5), 100), // stay reasonable
        auth_token: CRYPTOPANIC_TOKEN,
      };

      const { data } = await axios.get(url, { params, timeout: 10_000 });

      const items: CryptoPanicItem[] = (data?.results ?? []).map((r: any) => ({
        title: r?.title ?? "",
        url: r?.url ?? "",
        source: r?.source ?? { title: "", domain: "" },
        published_at: r?.published_at ?? new Date().toISOString(),
        currencies: r?.currencies,
      }));

      put(key, items, DAY_MS); // 24h TTL
      return items;
    } catch (err: any) {
      console.error("[cryptopanic] error:", err?.response?.status || err?.message || err);
      return [];
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
