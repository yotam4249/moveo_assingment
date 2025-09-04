// src/services/vendor/reddit_memes.ts
import axios from "axios";

const UA = process.env.REDDIT_UA || "CryptoDashboardBot/1.0 by yourname";
const SUBS = ["CryptoCurrencyMemes", "BitcoinMemes", "CryptoMemes"];

export type Meme = { url: string; caption: string };

const cache = new Map<string, { data: Meme[]; exp: number }>();
const put = (k: string, data: Meme[], ttlMs = 5 * 60_000) => cache.set(k, { data, exp: Date.now() + ttlMs });
const get = (k: string) => {
  const v = cache.get(k);
  if (!v) return null;
  if (Date.now() > v.exp) { cache.delete(k); return null; }
  return v.data;
};

async function fetchSub(sub: string): Promise<Meme[]> {
  const url = `https://www.reddit.com/r/${sub}/hot.json?limit=30`;
  const { data } = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 10_000 });
  const children = data?.data?.children ?? [];
  const memes: Meme[] = children
    .map((c: any) => c?.data)
    .filter((d: any) => d?.url && (d?.post_hint === "image" || /\.(jpg|jpeg|png|gif)$/i.test(d?.url)))
    .map((d: any) => ({ url: d.url, caption: d.title }));
  return memes;
}

export async function getRandomMeme(): Promise<Meme> {
  const key = `reddit:memes`;
  const cached = get(key);
  if (cached?.length) return cached[Math.floor(Math.random() * cached.length)];

  const lists = await Promise.allSettled(SUBS.map(fetchSub));
  const all: Meme[] = lists
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter(Boolean);

  if (!all.length) {
    return { url: "https://i.imgflip.com/30b1gx.jpg", caption: "HODL even the coffee ☕🚀" };
  }
  put(key, all, 5 * 60_000);
  return all[Math.floor(Math.random() * all.length)];
}
