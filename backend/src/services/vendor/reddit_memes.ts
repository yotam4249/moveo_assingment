// // src/services/vendor/reddit_memes.ts
// import axios from "axios";

// const UA = process.env.REDDIT_UA || "CryptoDashboardBot/1.0 by yourname";
// const SUBS = ["CryptoCurrencyMemes", "BitcoinMemes", "CryptoMemes"];

// export type Meme = { url: string; caption: string };

// const cache = new Map<string, { data: Meme[]; exp: number }>();
// const put = (k: string, data: Meme[], ttlMs = 5 * 60_000) => cache.set(k, { data, exp: Date.now() + ttlMs });
// const get = (k: string) => {
//   const v = cache.get(k);
//   if (!v) return null;
//   if (Date.now() > v.exp) { cache.delete(k); return null; }
//   return v.data;
// };

// async function fetchSub(sub: string): Promise<Meme[]> {
//   const url = `https://www.reddit.com/r/${sub}/hot.json?limit=30`;
//   const { data } = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 10_000 });
//   const children = data?.data?.children ?? [];
//   const memes: Meme[] = children
//     .map((c: any) => c?.data)
//     .filter((d: any) => d?.url && (d?.post_hint === "image" || /\.(jpg|jpeg|png|gif)$/i.test(d?.url)))
//     .map((d: any) => ({ url: d.url, caption: d.title }));
//   return memes;
// }

// export async function getRandomMeme(): Promise<Meme> {
//   const key = `reddit:memes`;
//   const cached = get(key);
//   if (cached?.length) return cached[Math.floor(Math.random() * cached.length)];

//   const lists = await Promise.allSettled(SUBS.map(fetchSub));
//   const all: Meme[] = lists
//     .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
//     .filter(Boolean);

//   if (!all.length) {
//     return { url: "https://i.imgflip.com/30b1gx.jpg", caption: "HODL even the coffee ☕🚀" };
//   }
//   put(key, all, 5 * 60_000);
//   return all[Math.floor(Math.random() * all.length)];
// }
// src/services/vendor/reddit_memes.ts
import axios from "axios";

const UA = process.env.REDDIT_UA || "CryptoDashboardBot/1.0 by yourname";
const SUBS = ["CryptoCurrencyMemes", "BitcoinMemes", "CryptoMemes"];

export type Meme = { url: string; caption: string };

// 5-min in-memory cache
const cache = new Map<string, { data: Meme[]; exp: number }>();
const put = (k: string, data: Meme[], ttlMs = 5 * 60_000) =>
  cache.set(k, { data, exp: Date.now() + ttlMs });
const get = (k: string) => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) { cache.delete(k); return null; }
  return v.data;
};

function isImageUrl(url: string): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".gif");
}

async function fetchSub(sub: string): Promise<Meme[]> {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=30`;
  const { data } = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 10_000 });
  const children = data?.data?.children ?? [];
  const memes: Meme[] = children
    .map((c: any) => c?.data)
    .filter((d: any) => d && !d.over_18) // skip NSFW
    .map((d: any) => {
      const url: string = d.url_overridden_by_dest || d.url || "";
      const title: string = d.title || "";
      return { url, caption: title };
    })
    .filter((m: { url: string; }) => isImageUrl(m.url));
  return memes;
}

/**
 * Return a random meme, avoiding `avoidUrl` if possible.
 * If all candidates equal the avoided one (rare), we return one anyway.
 */
export async function getRandomMeme(avoidUrl?: string): Promise<Meme> {
  const key = `reddit:memes`;
  const cached = get(key);

  let list = cached;
  if (!list || !list.length) {
    const lists = await Promise.allSettled(SUBS.map(fetchSub));
    const all: Meme[] = lists
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter(Boolean);
    if (!all.length) {
      return { url: "https://i.imgflip.com/30b1gx.jpg", caption: "HODL even the coffee ☕🚀" };
    }
    // de-duplicate by URL and cache for 5m
    list = Array.from(new Map(all.map((r) => [r.url, r])).values());
    put(key, list, 5 * 60_000);
  }

  const trimmedAvoid = String(avoidUrl || "").trim();
  const pool = trimmedAvoid ? list.filter((m) => m.url !== trimmedAvoid) : list;
  const pickFrom = pool.length ? pool : list; // if everything equals avoid, fallback

  const idx = Math.floor(Math.random() * pickFrom.length);
  return pickFrom[idx];
}

