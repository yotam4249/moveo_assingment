// src/services/vendor/coingecko.ts
import axios from "axios";

const COINGECKO_BASE =
  process.env.COINGECKO_BASE || "https://api.coingecko.com/api/v3";

/* ---------- normalize asset inputs (free-text → symbol) ---------- */
const NAME_TO_SYMBOL: Record<string, string> = {
  "BITCOIN": "BTC",
  "ETHEREUM": "ETH",
  "CARDANO": "ADA",
  "SOLANA": "SOL",
  "AVALANCHE": "AVAX",
  "BINANCE COIN": "BNB",
  "BINANCECOIN": "BNB",
  "DOGECOIN": "DOGE",
  "RIPPLE": "XRP",
  "POLKADOT": "DOT",
  "CHAINLINK": "LINK",
  "MATIC": "MATIC",
  "POLYGON": "MATIC",
  "SHIBA INU": "SHIB",
  "ARB": "ARB",
  "ARBITRUM": "ARB",
  "OPTIMISM": "OP",
};

function toSymbol(s: string): string {
  const up = s.trim().toUpperCase();
  return NAME_TO_SYMBOL[up] || up;
}

/* ---------- symbol -> CoinGecko id ---------- */
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
  DOT: "polkadot",
  LINK: "chainlink",
  MATIC: "matic-network",
  SHIB: "shiba-inu",
  ARB: "arbitrum",
  OP: "optimism",
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

/* ---------- tiny in-memory cache (60s) ---------- */
const cache = new Map<string, { data: any; exp: number }>();
const put = (k: string, data: any, ttlMs = 60_000) =>
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

export async function getMarketsByAssets(
  assets: string[],
  currency: string = "usd"
): Promise<CoinMarket[]> {
  const syms = assets.map(toSymbol);
  const ids = syms.map((s) => SYMBOL_TO_ID[s]).filter(Boolean).join(",");
  if (!ids) return [];

  const key = `cg:markets:${ids}:${currency}`;
  const cached = get(key);
  if (cached) return cached;

  try {
    const url = `${COINGECKO_BASE}/coins/markets`;
    const { data } = await axios.get(url, {
      params: {
        vs_currency: currency,
        ids,
        price_change_percentage: "24h",
      },
      timeout: 10_000,
    });
    put(key, data, 60_000);
    return data;
  } catch (e: any) {
    console.error("CoinGecko error:", e?.message || e);
    return [];
  }
}
