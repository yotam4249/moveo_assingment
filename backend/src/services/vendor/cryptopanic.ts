import axios from "axios";
import { XMLParser } from "fast-xml-parser";

const CRYPTOPANIC_BASE =
  process.env.CRYPTOPANIC_BASE || "https://cryptopanic.com/api/v1";
const CRYPTOPANIC_TOKEN = process.env.CRYPTOPANIC_TOKEN?.trim();

export type CryptoPanicItem = {
  title: string;
  url: string;
  source: { title: string; domain: string };
  published_at: string;
  currencies?: { code: string }[];
};

/* -------------------- lightweight cache -------------------- */
const DAY_MS = 24 * 60 * 60 * 1000;
type CacheVal = { data: CryptoPanicItem[]; exp: number };
const cache = new Map<string, CacheVal>();
let lastGood: CryptoPanicItem[] = [];

function put(key: string, data: CryptoPanicItem[], ttlMs = DAY_MS) {
  cache.set(key, { data, exp: Date.now() + ttlMs });
  if (data?.length) lastGood = data;
}
function getFresh(key: string): CryptoPanicItem[] | null {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() > v.exp) {
    cache.delete(key);
    return null;
  }
  return v.data;
}

let inflight: Promise<CryptoPanicItem[]> | null = null;

function buildUrl(withToken: boolean, limit: number) {
  const params: Record<string, string | number | boolean> = {
    kind: "news",
    filter: "rising",
    public: "true",
    limit: Math.min(Math.max(limit, 5), 100),
  };
  const qs = new URLSearchParams(params as any);
  if (withToken && CRYPTOPANIC_TOKEN) qs.set("auth_token", CRYPTOPANIC_TOKEN);
  return `${CRYPTOPANIC_BASE}/posts/?${qs.toString()}`;
}

/* -------------------- RSS fallbacks -------------------- */
/** Minimal mapper from RSS <item> to our shape */
function mapRssItem(srcTitle: string, domain: string, it: any): CryptoPanicItem {
  const title = String(it?.title ?? "").trim();
  const link =
    (typeof it?.link === "string" ? it.link :
     Array.isArray(it?.link) && it.link.length ? String(it.link[0]) : "") || "";
  const pub =
    String(it?.pubDate || it?.pubdate || it?.published || new Date().toISOString());
  return {
    title,
    url: link,
    source: { title: srcTitle, domain },
    published_at: new Date(pub).toISOString(),
    currencies: [],
  };
}

async function fetchRss(url: string, srcTitle: string, domain: string, limit = 30): Promise<CryptoPanicItem[]> {
  try {
    const res = await axios.get(url, { timeout: 12000, responseType: "text" });
    const parser = new XMLParser({ ignoreAttributes: false });
    const xml = parser.parse(res.data);
    const items =
      xml?.rss?.channel?.item ||
      xml?.feed?.entry ||        // Atom
      [];
    const arr = Array.isArray(items) ? items : [items];
    return arr.slice(0, limit).map((it) => mapRssItem(srcTitle, domain, it));
  } catch (e) {
    return [];
  }
}

/** Try a bundle of reputable crypto feeds */
async function backupNews(limit = 80): Promise<CryptoPanicItem[]> {
  const [coindesk, cointele, theblock] = await Promise.all([
    fetchRss("https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml", "CoinDesk", "coindesk.com", limit),
    fetchRss("https://cointelegraph.com/rss", "Cointelegraph", "cointelegraph.com", limit),
    fetchRss("https://www.theblock.co/rss", "The Block", "theblock.co", limit),
  ]);

  // Merge, de-dupe by URL, keep most recent first
  const merged = [...coindesk, ...cointele, ...theblock]
    .filter((x) => x && x.url && x.title)
    .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));

  const seen = new Set<string>();
  const uniq: CryptoPanicItem[] = [];
  for (const it of merged) {
    const k = it.url || it.title;
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(it);
    }
    if (uniq.length >= limit) break;
  }
  return uniq;
}

/* -------------------- main -------------------- */
export async function getDailyNews(limit = 80): Promise<CryptoPanicItem[]> {
  const key = "cp:news:global";
  const cached = getFresh(key);
  if (cached) return cached;

  if (inflight) return inflight;

  inflight = (async () => {
    const urls: string[] = [];
    if (CRYPTOPANIC_TOKEN) urls.push(buildUrl(true, limit));
    urls.push(buildUrl(false, limit)); // public fallback

    let lastErr: any = null;
    for (const url of urls) {
      try {
        const { data } = await axios.get(url, { timeout: 12000 });
        const items: CryptoPanicItem[] = (data?.results ?? []).map((r: any) => ({
          title: r?.title ?? "",
          url: r?.url ?? "",
          source: r?.source ?? { title: "", domain: "" },
          published_at: r?.published_at ?? new Date().toISOString(),
          currencies: r?.currencies,
        }));
        if (items.length) {
          put(key, items, DAY_MS);
          return items.slice(0, limit);
        }
      } catch (e) {
        lastErr = e;
      }
    }

    // Vendor down or empty: use RSS backups
    const rss = await backupNews(limit);
    if (rss.length) {
      console.warn(
        "[cryptopanic] vendor empty/failed; serving RSS fallback:",
        rss.length
      );
      // cache shorter to re-check vendor soon
      put(key, rss, 60 * 60 * 1000); // 1h TTL for fallback cache
      return rss.slice(0, limit);
    }

    // Hard fallback to lastGood if we have it
    if (lastGood.length) {
      console.warn(
        "[cryptopanic] using lastGood cache; vendor + RSS failed:",
        lastErr?.response?.status || lastErr?.message || lastErr
      );
      put(key, lastGood, 10 * 60 * 1000);
      return lastGood.slice(0, limit);
    }

    console.warn(
      "[cryptopanic] failed with no cache:",
      lastErr?.response?.status || lastErr?.message || lastErr
    );
    return [];
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
