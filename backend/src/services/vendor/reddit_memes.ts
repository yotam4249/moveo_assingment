// src/services/vendor/reddit_memes.ts
import axios from "axios";

const UA =
  process.env.REDDIT_UA ||
  "CryptoInvestorDashboard/1.5.0 (Node.js; memes) contact: you@example.com; instance: unknown";
const CLIENT_ID = process.env.REDDIT_CLIENT_ID || "";
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || "";

// You can add more if you like:
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
  // cached and still valid?
  if (tokenCache.token && Date.now() < tokenCache.exp - 60_000) {
    return tokenCache.token;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("[reddit] Missing REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET");
    throw new Error("Missing REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET");
  }

  // IMPORTANT: include scope=read
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "read",
  }).toString();

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  console.log("[reddit] requesting OAuth token (client_credentials, scope=read)");
  const resp = await axios.post(
    "https://www.reddit.com/api/v1/access_token",
    body,
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
  console.log("[reddit] OAuth token acquired; expires_in(s) =", Math.floor(ttl / 1000));
  return tok;
}

async function fetchSubOAuth(sub: string, bearer: string): Promise<Meme[]> {
  const url = `https://oauth.reddit.com/r/${sub}/hot`;
  try {
    const { data } = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        "User-Agent": UA,
        Accept: "application/json",
      },
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

      // If not a direct image, try preview
      if (!isImageUrl(mediaUrl)) {
        const prev = d.preview?.images?.[0]?.source?.url;
        if (prev && isImageUrl(cleanUrl(prev))) mediaUrl = cleanUrl(prev);
      }

      if (!isImageUrl(mediaUrl)) continue;

      out.push({ url: mediaUrl, caption: d.title || "" });
    }
    console.log(`[reddit] /r/${sub} yielded ${out.length} image posts`);
    return out;
  } catch (e: any) {
    const code = e?.response?.status;
    console.warn(`[reddit] /r/${sub} failed`, code || e?.message || e);
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
  if (cached?.length) {
    const chosen = pickDifferent(cached, avoidUrl) || { url: "", caption: "" };
    console.log("[reddit] choose from cache; pool size =", cached.length, "chosen =", chosen.url);
    return chosen;
  }

  // Fetch fresh list via OAuth
  const bearer = await getBearerToken();
  const lists = await Promise.allSettled(SUBS.map((s) => fetchSubOAuth(s, bearer)));
  const all: Meme[] = lists
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((m) => m && m.url);

  // de-dupe by URL
  const uniq = Array.from(new Map(all.map((m) => [m.url, m])).values());
  console.log("[reddit] combined pool size =", uniq.length);

  if (uniq.length) {
    cachePut(key, uniq, LIST_CACHE_TTL);
    const chosen = pickDifferent(uniq, avoidUrl) || { url: "", caption: "" };
    console.log("[reddit] choose fresh; chosen =", chosen.url);
    return chosen;
  }

  // Nothing from Reddit right now
  console.warn("[reddit] no image posts found from subs this round");
  return { url: "", caption: "" }; // UI will show "No meme available"
}
