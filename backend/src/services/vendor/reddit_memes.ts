import axios from "axios";

const UA =
  process.env.REDDIT_UA ||
  "CryptoInvestorDashboard/1.6.0 (Node.js; memes) contact: you@example.com; instance: unknown";

// 🔑 Reddit app config
// Use an **Installed App** on https://www.reddit.com/prefs/apps
// client_id is required; secret is blank for installed apps
const CLIENT_ID = process.env.REDDIT_CLIENT_ID || "";
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET ?? ""; // may be "" for installed
const APP_KIND = (process.env.REDDIT_APP_KIND || "installed").toLowerCase(); // "installed" | "web" | "script"
const DEVICE_ID = process.env.REDDIT_DEVICE_ID || "DO_NOT_TRACK_THIS_DEVICE"; // any stable string/uuid for installed grant

// widen pool a bit
const SUBS = ["CryptoCurrencyMemes", "BitcoinMemes", "CryptoMemes", "cryptomemes"];

export type Meme = { url: string; caption: string };

const LIST_CACHE_TTL = 5 * 60_000; // 5 minutes
const listCache = new Map<string, { data: Meme[]; exp: number }>();
let lastGoodList: Meme[] = [];
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

/** Get a bearer token using the correct Reddit grant.
 *
 * For **Installed App (userless)**:
 *   grant_type=https://oauth.reddit.com/grants/installed_client
 *   device_id=DO_NOT_TRACK_THIS_DEVICE (or your own stable id)
 *   Basic auth = base64(client_id + ":")   // empty secret
 *
 * For **Web/Script** (rarely needed here), we’d use user auth; we keep
 * client_credentials only as a best-effort fallback if configured.
 */
async function getBearerToken(): Promise<string> {
  if (tokenCache.token && Date.now() < tokenCache.exp - 60_000) {
    return tokenCache.token;
  }
  if (!CLIENT_ID) {
    console.error("[reddit] Missing REDDIT_CLIENT_ID");
    throw new Error("Missing REDDIT_CLIENT_ID");
  }

  let body: string;
  let authHeader: string;

  if (APP_KIND === "installed" || CLIENT_SECRET === "") {
    // ✅ Installed client userless OAuth
    body = new URLSearchParams({
      grant_type: "https://oauth.reddit.com/grants/installed_client",
      device_id: DEVICE_ID,
      scope: "read",
    }).toString();
    authHeader = "Basic " + Buffer.from(`${CLIENT_ID}:`).toString("base64");
    console.log("[reddit] requesting OAuth token (installed_client, scope=read, device_id=", DEVICE_ID, ")");
  } else {
    // Fallback (may not be allowed for content): client_credentials
    body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "read",
    }).toString();
    authHeader = "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    console.log("[reddit] requesting OAuth token (client_credentials, scope=read)");
  }

  const resp = await axios.post(
    "https://www.reddit.com/api/v1/access_token",
    body,
    {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      timeout: 12_000,
      validateStatus: () => true,
    }
  );

  if (resp.status !== 200) {
    console.warn("[reddit] OAuth token request failed:", resp.status, resp.data);
    throw new Error(`OAuth failed (${resp.status})`);
  }

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
    const { data, status } = await axios.get(url, {
      headers: { Authorization: `Bearer ${bearer}`, "User-Agent": UA, Accept: "application/json" },
      params: { limit: 50, raw_json: 1 },
      timeout: 10_000,
      validateStatus: () => true,
    });
    if (status !== 200) {
      console.warn(`[reddit] OAuth /r/${sub} failed`, status);
      return [];
    }

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
    console.log(`[reddit] OAuth /r/${sub} yielded ${out.length} image posts`);
    return out;
  } catch (e: any) {
    console.warn(`[reddit] OAuth /r/${sub} error`, e?.response?.status || e?.message || e);
    return [];
  }
}

async function fetchSubPublic(sub: string): Promise<Meme[]> {
  const url = `https://www.reddit.com/r/${sub}/hot.json`;
  try {
    const { data, status } = await axios.get(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      params: { limit: 50, raw_json: 1 },
      timeout: 10_000,
      validateStatus: () => true,
    });
    if (status !== 200) {
      console.warn(`[reddit] Public /r/${sub} failed`, status);
      return [];
    }

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
    console.log(`[reddit] Public /r/${sub} yielded ${out.length} image posts`);
    return out;
  } catch (e: any) {
    console.warn(`[reddit] Public /r/${sub} error`, e?.response?.status || e?.message || e);
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

/** Return a Reddit meme (tries installed-client OAuth first, then public JSON). */
export async function getRandomMeme(avoidUrl?: string): Promise<Meme> {
  const key = "reddit:memes:v2";
  const cached = cacheGet(key);
  if (cached?.length) {
    const chosen = pickDifferent(cached, avoidUrl) || { url: "", caption: "" };
    console.log("[reddit] choose from cache; pool size =", cached.length, "chosen =", chosen.url);
    return chosen;
  }

  // 1) OAuth path (installed client)
  let combined: Meme[] = [];
  try {
    const bearer = await getBearerToken();
    const lists = await Promise.allSettled(SUBS.map((s) => fetchSubOAuth(s, bearer)));
    combined = lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  } catch (e: any) {
    console.warn("[reddit] OAuth token or fetch failed:", e?.message || e);
  }

  // 2) Fallback to public JSON if OAuth yielded nothing
  if (!combined.length) {
    const listsPub = await Promise.allSettled(SUBS.map((s) => fetchSubPublic(s)));
    combined = listsPub.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }

  // De-dupe by URL
  const uniq = Array.from(new Map(combined.map((m) => [m.url, m])).values());
  console.log("[reddit] combined pool size =", uniq.length);

  if (uniq.length) {
    cachePut(key, uniq, LIST_CACHE_TTL);
    lastGoodList = uniq;
    const chosen = pickDifferent(uniq, avoidUrl) || { url: "", caption: "" };
    console.log("[reddit] choose fresh; chosen =", chosen.url);
    return chosen;
  }

  // 3) Last-gasp: reuse last good list if we had any
  if (lastGoodList.length) {
    console.warn("[reddit] using lastGoodList; size =", lastGoodList.length);
    const chosen = pickDifferent(lastGoodList, avoidUrl) || { url: "", caption: "" };
    return chosen;
  }

  console.warn("[reddit] no image posts found from subs this round");
  return { url: "", caption: "" }; // UI will show "No meme available"
}
