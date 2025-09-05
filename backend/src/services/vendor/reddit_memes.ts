// src/services/vendor/reddit_memes.ts
import axios from "axios";

const UA =
  process.env.REDDIT_UA ||
  "CryptoInvestorDashboard/1.5.0 (Node.js; memes) contact: you@example.com; instance: unknown";
const CLIENT_ID = process.env.REDDIT_CLIENT_ID || "";
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || "";
const SUBS = ["CryptoCurrencyMemes", "BitcoinMemes", "CryptoMemes"];

export type Meme = { url: string; caption: string };

const LIST_CACHE_TTL = 5 * 60_000; // 5 min
const listCache = new Map<string, { data: Meme[]; exp: number }>();
const tokenCache = { token: "", exp: 0 };

function cachePut(key: string, data: Meme[], ttl = LIST_CACHE_TTL) {
  listCache.set(key, { data, exp: Date.now() + ttl });
}
function cacheGet(key: string): Meme[] | null {
  const v = listCache.get(key);
  if (!v) return null;
  if (Date.now() > v.exp) { listCache.delete(key); return null; }
  return v.data;
}

function isImageUrl(url: string): boolean {
  const u = (url || "").toLowerCase();
  return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".gif");
}
function cleanUrl(u: string): string {
  return (u || "").replace(/&amp;/g, "&");
}

async function getBearerToken(): Promise<string> {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("Missing REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET");

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const resp = await axios.post(
    "https://www.reddit.com/api/v1/access_token",
    new URLSearchParams({ grant_type: "client_credentials" }).toString(),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      timeout: 10_000,
    }
  );

  const tok = resp.data?.access_token as string;
  const ttl = Number(resp.data?.expires_in || 3600) * 1000;
  if (!tok) throw new Error("Reddit OAuth: no access_token");
  tokenCache.token = tok;
  tokenCache.exp = Date.now() + ttl;
  return tok;
}

async function fetchSubOAuth(sub: string, bearer: string): Promise<Meme[]> {
  const url = `https://oauth.reddit.com/r/${sub}/hot`;
  try {
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${bearer}`, "User-Agent": UA, Accept: "application/json" },
      params: { limit: 50, raw_json: 1 },
      timeout: 10_000,
    });

    const children = data?.data?.children ?? [];
    const out: Meme[] = [];
    for (const c of children) {
      const d = c?.data;
      if (!d || d.over_18) continue;

      let mediaUrl: string = d.url_overridden_by_dest || d.url || "";
      mediaUrl = cleanUrl(mediaUrl);
      if (!isImageUrl(mediaUrl)) {
        const prev = d.preview?.images?.[0]?.source?.url;
        if (prev && isImageUrl(cleanUrl(prev))) mediaUrl = cleanUrl(prev);
      }
      if (!isImageUrl(mediaUrl)) continue;

      out.push({ url: mediaUrl, caption: d.title || "" });
    }
    return out;
  } catch {
    return [];
  }
}

function pickDifferent(list: Meme[], avoidUrl?: string): Meme | null {
  if (!list.length) return null;
  const avoid = (avoidUrl || "").trim();
  const pool = avoid ? list.filter((m) => m.url !== avoid) : list;
  const pickFrom = pool.length ? pool : list;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)];
}

/** Return a random Reddit meme (OAuth), avoiding `avoidUrl` when possible. */
export async function getRandomMeme(avoidUrl?: string): Promise<Meme> {
  const key = "reddit:memes:v2";
  const cached = cacheGet(key);
  if (cached?.length) return pickDifferent(cached, avoidUrl) || { url: "", caption: "" };

  const bearer = await getBearerToken();
  const lists = await Promise.allSettled(SUBS.map((s) => fetchSubOAuth(s, bearer)));
  const all = lists.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((m) => m && m.url);

  // de-duplicate by URL
  const uniq = Array.from(new Map(all.map((m) => [m.url, m])).values());

  if (uniq.length) {
    cachePut(key, uniq, LIST_CACHE_TTL);
    return pickDifferent(uniq, avoidUrl) || { url: "", caption: "" };
  }
  return { url: "", caption: "" }; // Reddit yielded nothing (no hardcoded fallback)
}
