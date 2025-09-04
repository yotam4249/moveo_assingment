// src/services/vendor/coingecko.ts
import axios from "axios";

const COINGECKO_BASE = process.env.COINGECKO_BASE || "https://api.coingecko.com/api/v3";

// Cache פשוט בזיכרון
const cache = new Map<string, { data: any; exp: number }>();
const put = (k: string, data: any, ttlMs = 60_000) => cache.set(k, { data, exp: Date.now() + ttlMs });
const get = (k: string) => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) { cache.delete(k); return null; }
  return v.data;
};

// מיפוי סמלים -> CoinGecko IDs (הרחב לפי צורך)
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  AVAX: "avalanche-2",
  BNB: "binancecoin",
  DOGE: "dogecoin",
  XRP: "ripple",
  LTC: "litecoin",
};

export type CoinMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap_rank?: number;
};

export async function getMarketsByAssets(assets: string[], currency: string = "usd"): Promise<CoinMarket[]> {
  const ids = assets
    .map((s) => SYMBOL_TO_ID[s.toUpperCase()])
    .filter(Boolean)
    .join(",");

  if (!ids) return [];

  const key = `cg:markets:${ids}:${currency}`;
  const cached = get(key);
  if (cached) return cached;

  const url = `${COINGECKO_BASE}/coins/markets`;
  const { data } = await axios.get(url, {
    params: { vs_currency: currency, ids, price_change_percentage: "24h" },
    timeout: 10_000,
  });

  put(key, data, 60_000);
  return data;
}
