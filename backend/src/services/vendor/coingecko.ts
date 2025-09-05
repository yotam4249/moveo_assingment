// // src/services/vendor/coingecko.ts
// import axios from "axios";

// const COINGECKO_BASE =
//   process.env.COINGECKO_BASE || "https://api.coingecko.com/api/v3";

// /* ---------- normalize asset inputs (free-text → symbol) ---------- */
// const NAME_TO_SYMBOL: Record<string, string> = {
//   "BITCOIN": "BTC",
//   "ETHEREUM": "ETH",
//   "CARDANO": "ADA",
//   "SOLANA": "SOL",
//   "AVALANCHE": "AVAX",
//   "BINANCE COIN": "BNB",
//   "BINANCECOIN": "BNB",
//   "DOGECOIN": "DOGE",
//   "RIPPLE": "XRP",
//   "POLKADOT": "DOT",
//   "CHAINLINK": "LINK",
//   "MATIC": "MATIC",
//   "POLYGON": "MATIC",
//   "SHIBA INU": "SHIB",
//   "ARB": "ARB",
//   "ARBITRUM": "ARB",
//   "OPTIMISM": "OP",
// };

// function toSymbol(s: string): string {
//   const up = s.trim().toUpperCase();
//   return NAME_TO_SYMBOL[up] || up;
// }

// /* ---------- symbol -> CoinGecko id ---------- */
// const SYMBOL_TO_ID: Record<string, string> = {
//   BTC: "bitcoin",
//   ETH: "ethereum",
//   SOL: "solana",
//   ADA: "cardano",
//   AVAX: "avalanche-2",
//   BNB: "binancecoin",
//   DOGE: "dogecoin",
//   XRP: "ripple",
//   LTC: "litecoin",
//   DOT: "polkadot",
//   LINK: "chainlink",
//   MATIC: "matic-network",
//   SHIB: "shiba-inu",
//   ARB: "arbitrum",
//   OP: "optimism",
// };

// export type CoinMarket = {
//   id: string;
//   symbol: string;
//   name: string;
//   image: string;
//   current_price: number;
//   price_change_percentage_24h: number;
//   market_cap_rank?: number;
// };

// /* ---------- tiny in-memory cache (60s) ---------- */
// const cache = new Map<string, { data: any; exp: number }>();
// const put = (k: string, data: any, ttlMs = 60_000) =>
//   cache.set(k, { data, exp: Date.now() + ttlMs });
// const get = (k: string) => {
//   const v = cache.get(k);
//   if (!v) return null;
//   if (Date.now() > v.exp) {
//     cache.delete(k);
//     return null;
//   }
//   return v.data;
// };

// export async function getMarketsByAssets(
//   assets: string[],
//   currency: string = "usd"
// ): Promise<CoinMarket[]> {
//   const syms = assets.map(toSymbol);
//   const ids = syms.map((s) => SYMBOL_TO_ID[s]).filter(Boolean).join(",");
//   if (!ids) return [];

//   const key = `cg:markets:${ids}:${currency}`;
//   const cached = get(key);
//   if (cached) return cached;

//   try {
//     const url = `${COINGECKO_BASE}/coins/markets`;
//     const { data } = await axios.get(url, {
//       params: {
//         vs_currency: currency,
//         ids,
//         price_change_percentage: "24h",
//       },
//       timeout: 10_000,
//     });
//     put(key, data, 60_000);
//     return data;
//   } catch (e: any) {
//     console.error("CoinGecko error:", e?.message || e);
//     return [];
//   }
// }
// src/services/vendor/coingecko.ts
import axios from "axios";

const COINGECKO_BASE = process.env.COINGECKO_BASE || "https://api.coingecko.com/api/v3";
const UA = process.env.REDDIT_UA || "CryptoAdvisor/1.0";
const CG_KEY = process.env.COINGECKO_API_KEY || process.env.COINGECKO_KEY; // optional

/* ---------- normalize asset inputs (free-text → symbol) ---------- */
const NAME_TO_SYMBOL: Record<string, string> = {
  BITCOIN: "BTC", ETHEREUM: "ETH", CARDANO: "ADA", SOLANA: "SOL", AVALANCHE: "AVAX",
  "BINANCE COIN": "BNB", BINANCECOIN: "BNB", DOGECOIN: "DOGE", RIPPLE: "XRP",
  POLKADOT: "DOT", CHAINLINK: "LINK", MATIC: "MATIC", POLYGON: "MATIC",
  "SHIBA INU": "SHIB", ARB: "ARB", ARBITRUM: "ARB", OPTIMISM: "OP",
};
function toSymbol(s: string): string {
  const up = s.trim().toUpperCase();
  return NAME_TO_SYMBOL[up] || up;
}

/* ---------- symbol -> CoinGecko id ---------- */
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", ADA: "cardano", AVAX: "avalanche-2",
  BNB: "binancecoin", DOGE: "dogecoin", XRP: "ripple", LTC: "litecoin",
  DOT: "polkadot", LINK: "chainlink", MATIC: "matic-network", SHIB: "shiba-inu",
  ARB: "arbitrum", OP: "optimism",
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

/* ---------- cache (60s) + single-flight ---------- */
const CACHE_TTL = 60_000;
const cache = new Map<string, { data: any; exp: number }>();
const inflight = new Map<string, Promise<any>>();
const put = (k: string, data: any, ttlMs = CACHE_TTL) =>
  cache.set(k, { data, exp: Date.now() + ttlMs });
const get = (k: string) => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) { cache.delete(k); return null; }
  return v.data;
};

async function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const c = get(key);
  if (c) return c as T;
  if (inflight.has(key)) return inflight.get(key)! as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/* ---------- API ---------- */
export async function getMarketsByAssets(
  assets: string[],
  currency: string = "usd"
): Promise<CoinMarket[]> {
  // turn any free-text into symbols -> ids
  const syms = (assets || []).map(toSymbol);
  const ids = syms.map((s) => SYMBOL_TO_ID[s]).filter(Boolean).join(",");
  if (!ids) return [];

  const key = `cg:markets:${ids}:${currency}`;
  return once(key, async () => {
    const url = `${COINGECKO_BASE}/coins/markets`;
    try {
      const { data } = await axios.get(url, {
        params: { vs_currency: currency, ids, price_change_percentage: "24h" },
        timeout: 10_000,
        headers: {
          "User-Agent": UA,
          ...(CG_KEY ? { "x-cg-api-key": CG_KEY } : {}), // if you ever add a key
        },
      });
      put(key, data);
      return data;
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 429) {
        // brief backoff once
        await new Promise((r) => setTimeout(r, 1500));
        const { data } = await axios.get(url, {
          params: { vs_currency: currency, ids, price_change_percentage: "24h" },
          timeout: 10_000,
          headers: { "User-Agent": UA, ...(CG_KEY ? { "x-cg-api-key": CG_KEY } : {}) },
        });
        put(key, data);
        return data;
      }
      console.error("CoinGecko error:", status || e?.message || e);
      return [];
    }
  });
}
