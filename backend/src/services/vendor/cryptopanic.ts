// src/services/vendor/cryptopanic.ts
import axios from "axios";

const CRYPTOPANIC_BASE = process.env.CRYPTOPANIC_BASE || "https://cryptopanic.com/api/v1";
const CRYPTOPANIC_TOKEN = process.env.CRYPTOPANIC_TOKEN; // אופציונלי (חינמי)

const cache = new Map<string, { data: any; exp: number }>();
const put = (k: string, data: any, ttlMs = 60_000) => cache.set(k, { data, exp: Date.now() + ttlMs });
const get = (k: string) => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) { cache.delete(k); return null; }
  return v.data;
};

export type CryptoPanicItem = {
  title: string;
  url: string;
  source: { title: string; domain: string };
  published_at: string;
  currencies?: { code: string }[];
};

export async function getNewsForAssets(assets: string[], limit = 30): Promise<CryptoPanicItem[]> {
  const currencies = assets.map(a => a.toUpperCase()).join(",");
  const key = `cp:news:${currencies}:${limit}`;
  const cached = get(key);
  if (cached) return cached;

  const params: any = {
    kind: "news",
    filter: "rising",
    public: "true",
    limit: Math.min(Math.max(limit, 5), 50),
  };
  if (CRYPTOPANIC_TOKEN) params.auth_token = CRYPTOPANIC_TOKEN;
  if (currencies) params.currencies = currencies;

  const url = `${CRYPTOPANIC_BASE}/posts/`;
  const { data } = await axios.get(url, { params, timeout: 10_000 });

  const items: CryptoPanicItem[] = (data?.results ?? []).map((r: any) => ({
    title: r.title,
    url: r.url,
    source: r.source,
    published_at: r.published_at,
    currencies: r.currencies,
  }));

  put(key, items, 60_000);
  return items;
}
