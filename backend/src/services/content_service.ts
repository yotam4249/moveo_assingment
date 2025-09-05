// // src/services/content_service.ts
// import userModel from "../models/users_model";
// import { getMarketsByAssets } from "./vendor/coingecko";
// import { getDailyNews } from "./vendor/cryptopanic";
// import { freeRerank, RankItem } from "./vendor/free_rerank";
// import { chatFree } from "./vendor/openrouter";

// /* ---------------- types ---------------- */
// export type ContentTag = "news" | "prices" | "insight";
// export interface ContentItem {
//   id: string;
//   title: string;
//   summary: string;
//   url?: string;
//   tags: ContentTag[];
//   assets: string[];
//   publishedAt?: Date;
//   source?: string;
//   score?: number; // derived score used for ordering
// }

// export interface RankedFeed {
//   news: ContentItem[];
//   prices: ContentItem[];
//   insight: ContentItem[];
// }

// /* ---------------- utils ---------------- */
// function scoresFromMaybeMap(m: any): Record<string, number> {
//   if (!m) return {};
//   try {
//     if (typeof (m as any).get === "function" && typeof (m as any).entries === "function") {
//       return Object.fromEntries(Array.from((m as any).entries()));
//     }
//     if (typeof m === "object") return { ...(m as Record<string, number>) };
//   } catch {}
//   return {};
// }
// function safeHostname(u?: string): string {
//   if (!u) return "unknown";
//   try { return new URL(u).hostname; } catch { return "unknown"; }
// }
// const toSym = (s: string) => String(s || "").trim().toUpperCase();

// // Tiny deterministic hash for stable IDs
// function hashId(s: string): string {
//   let h = 0;
//   for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
//   return Math.abs(h).toString(36);
// }

// const SYMBOL_SYNONYMS: Record<string, string[]> = {
//   BTC: ["BTC", "BITCOIN"], ETH: ["ETH", "ETHEREUM"], ADA: ["ADA", "CARDANO"],
//   SOL: ["SOL", "SOLANA"], AVAX: ["AVAX", "AVALANCHE"], BNB: ["BNB", "BINANCE COIN", "BINANCECOIN"],
//   DOGE: ["DOGE", "DOGECOIN"], XRP: ["XRP", "RIPPLE"], LTC: ["LTC", "LITECOIN"],
//   DOT: ["DOT", "POLKADOT"], LINK: ["LINK", "CHAINLINK"], MATIC: ["MATIC", "POLYGON"],
//   SHIB: ["SHIB", "SHIBA INU"], ARB: ["ARB", "ARBITRUM"], OP: ["OP", "OPTIMISM"],
// };
// function keywordRegexForAssets(assets: string[]): RegExp | null {
//   const kws = assets
//     .flatMap((s) => SYMBOL_SYNONYMS[s] ?? [s])
//     .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
//   if (!kws.length) return null;
//   return new RegExp(`\\b(${kws.join("|")})\\b`, "i");
// }
// const primaryTag = (it: ContentItem): ContentTag =>
//   it.tags.includes("news") ? "news" : it.tags.includes("insight") ? "insight" : "prices";

// // 🔧 pick the highest-scoring asset from user's assets
// function pickTopAsset(assets: string[], assetScores: Record<string, number>): string | undefined {
//   return sortAssetsByScore(assets, assetScores)[0];
// }

// // 🔧 NEW: sort assets by score desc (default baseline 100 if missing)
// function sortAssetsByScore(assets: string[], assetScores: Record<string, number>): string[] {
//   return [...(assets ?? [])].sort((a, b) => {
//     const sa = Number.isFinite(assetScores[a]) ? assetScores[a] : 100;
//     const sb = Number.isFinite(assetScores[b]) ? assetScores[b] : 100;
//     return sb - sa;
//   });
// }

// function keyToSlug(k: string): string {
//   return String(k).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
// }
// function rankWithScores(
//   items: ContentItem[],
//   profile: {
//     assets: string[];
//     contentPrefs: ContentTag[];
//     investorType: string;
//     assetScores: Record<string, number>;
//     contentScores: Record<string, number>;
//   }
// ): ContentItem[] {
//   if (!items.length) return [];

//   const rankables: RankItem[] = items.map((t) => ({
//     id: t.id,
//     title: t.title,
//     summary: t.summary,
//     tags: t.tags,
//     assets: t.assets,
//     url: t.url,
//     publishedAt: t.publishedAt,
//     source: t.source,
//   }));

//   const ranked = freeRerank(rankables, profile);
//   const byId = new Map(items.map((i) => [i.id, i]));
//   const N = ranked.length;

//   const withScores: ContentItem[] = ranked.map((r, idx) => {
//     const base = byId.get(r.id) || (r as unknown as ContentItem);
//     if (base.tags.includes("insight")) {
//       return { ...base, score: 1 };   // ✅ always fixed score
//     }
//     return { ...base, score: N - idx };
//   });

//   withScores.sort((a, b) => {
//     const s = (b.score ?? 0) - (a.score ?? 0);
//     if (s !== 0) return s;
//     const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
//     const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
//     return tb - ta;
//   });

//   return withScores;
// }

// /** Rank and attach scores (no per-item overrides here). */
// // function rankWithScores(
// //   items: ContentItem[],
// //   profile: {
// //     assets: string[];
// //     contentPrefs: ContentTag[];
// //     investorType: string;
// //     assetScores: Record<string, number>;
// //     contentScores: Record<string, number>;
// //   }
// // ): ContentItem[] {
// //   if (!items.length) return [];
// //   const rankables: RankItem[] = items.map((t) => ({
// //     id: t.id,
// //     title: t.title,
// //     summary: t.summary,
// //     tags: t.tags,
// //     assets: t.assets,
// //     url: t.url,
// //     publishedAt: t.publishedAt,
// //     source: t.source,
// //   }));
// //   const ranked = freeRerank(rankables, profile);
// //   const byId = new Map(items.map((i) => [i.id, i]));
// //   const N = ranked.length;
// //   const withScores: ContentItem[] = ranked.map((r, idx) => {
// //     const base = byId.get(r.id) || (r as unknown as ContentItem);
// //     return { ...base, score: N - idx };
// //   });

// //   withScores.sort((a, b) => {
// //     const s = (b.score ?? 0) - (a.score ?? 0);
// //     if (s !== 0) return s;
// //     const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
// //     const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
// //     return tb - ta;
// //   });

// //   return withScores;
// // }

// // 🔧 helper: choose top content tag strictly from contentScores map
// function topContentTagFromScores(scores: Record<string, number>): ContentTag {
//   const CANDIDATES: ContentTag[] = ["news", "prices", "insight"];
//   const entries = Object.entries(scores).filter(([k]) => (CANDIDATES as string[]).includes(k));
//   if (!entries.length) return "news";
//   entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
//   return entries[0][0] as ContentTag;
// }

// /* ---------------- core builder ---------------- */
// async function buildAllContent(userId: string): Promise<{
//   assets: string[];
//   contentPrefs: ContentTag[];
//   priceItems: ContentItem[];
//   newsItems: ContentItem[];
//   insights: ContentItem[];
//   profile: {
//     assets: string[];
//     contentPrefs: ContentTag[];
//     investorType: string;
//     assetScores: Record<string, number>;
//     contentScores: Record<string, number>;
//   };
// }> {
//   const user = await userModel.findById(userId).lean();
//   const empty = {
//     assets: [],
//     contentPrefs: [],
//     priceItems: [],
//     newsItems: [],
//     insights: [],
//     profile: {
//       assets: [],
//       contentPrefs: [],
//       investorType: "",
//       assetScores: {},
//       contentScores: {},
//     },
//   };
//   if (!user) return empty;

//   const assets = (user.onboarding?.assets ?? []).map(toSym);
//   const contentPrefs = (user.onboarding?.contentPrefs ?? []) as ContentTag[];
//   const assetScores = scoresFromMaybeMap(user.recommendationProfile?.assetScores);
//   const contentScores = scoresFromMaybeMap(user.recommendationProfile?.contentScores);

//   // 🔧 assets by score (desc)
//   const assetsByScore = sortAssetsByScore(assets, assetScores);
//   const topAsset = assetsByScore[0];
//   console.log("[content] user assets:", assets, "assetsByScore:", assetsByScore);

//   /* -------- 1) PRICES (try top → next → ...) -------- */
//   let priceItems: ContentItem[] = [];
//   try {
//     // If we have scored assets, attempt single-asset queries in order until we get data
//     if (assetsByScore.length) {
//       let found: any[] | null = null;
//       let usedSymbol: string | null = null;

//       for (const sym of assetsByScore) {
//         const markets = await getMarketsByAssets([sym]); // ask CG only for this symbol
//         const filt = markets.filter((m) => (m.symbol || "").toUpperCase() === sym);
//         if (filt.length) {
//           found = filt;
//           usedSymbol = sym;
//           break;
//         }
//       }

//       // If none produced data, fall back to all assets at once (old behavior)
//       const finalMarkets = found ?? (await getMarketsByAssets(assets));

//       priceItems = finalMarkets.map((m) => ({
//         id: `price:${m.id}`,
//         title: `${m.name} (${m.symbol.toUpperCase()}): $${m.current_price.toLocaleString()} (${m.price_change_percentage_24h?.toFixed?.(2)}% 24h)`,
//         summary: `24h: ${m.price_change_percentage_24h?.toFixed?.(2)}% • Rank: ${m.market_cap_rank ?? "?"}`,
//         url: `https://www.coingecko.com/en/coins/${m.id}`,
//         tags: ["prices"],
//         assets: [m.symbol.toUpperCase()],
//         publishedAt: new Date(),
//         source: "CoinGecko",
//       }));

//       console.log("[content] prices picked for:", usedSymbol ?? "fallback:all", "count:", priceItems.length);
//     } else {
//       // no assets – fall back to nothing or global fetch if you want
//       const markets = await getMarketsByAssets([]);
//       priceItems = markets.map((m) => ({
//         id: `price:${m.id}`,
//         title: `${m.name} (${m.symbol.toUpperCase()}): $${m.current_price.toLocaleString()} (${m.price_change_percentage_24h?.toFixed?.(2)}% 24h)`,
//         summary: `24h: ${m.price_change_percentage_24h?.toFixed?.(2)}% • Rank: ${m.market_cap_rank ?? "?"}`,
//         url: `https://www.coingecko.com/en/coins/${m.id}`,
//         tags: ["prices"],
//         assets: [m.symbol.toUpperCase()],
//         publishedAt: new Date(),
//         source: "CoinGecko",
//       }));
//     }
//   } catch (e) {
//     console.warn("[content] coingecko failed:", (e as any)?.message || e);
//   }

//   /* -------- 2) NEWS (daily cached; resilient; try top → next → ...) -------- */
//   let newsItems: ContentItem[] = [];
//   try {
//     const newsRaw = await getDailyNews(80);

//     // Broad filter (your existing logic)
//     let filtered = assets.length
//       ? newsRaw.filter((n) =>
//           (n.currencies ?? []).some((c) => assets.includes(toSym(c.code || ""))))
//       : newsRaw;

//     if (assets.length) {
//       const rx = keywordRegexForAssets(assets);
//       if (rx && filtered.length < 6) {
//         const byTitle = newsRaw.filter((n) => rx.test(n.title || ""));
//         const seen = new Set<string>(filtered.map((x) => x.url || x.title));
//         for (const it of byTitle) {
//           const key = it.url || it.title;
//           if (!seen.has(key)) { filtered.push(it); seen.add(key); }
//         }
//       }
//     }

//     if (filtered.length === 0) filtered = newsRaw.slice(0, 20);

//     // 🔧 NEW: try to constrain to each asset in score order; pick first that yields results
//     let constrained: typeof filtered | null = null;
//     if (assetsByScore.length) {
//       for (const sym of assetsByScore) {
//         const rxTop = keywordRegexForAssets([sym]);
//         const strictByCurrency = filtered.filter((n) =>
//           (n.currencies ?? []).some((c) => toSym(c.code || "") === sym)
//         );
//         const byTitleTop = rxTop ? filtered.filter((n) => rxTop.test(n.title || "")) : [];

//         // union unique (by url/title)
//         const union = [...strictByCurrency];
//         const seen = new Set<string>(union.map((x) => x.url || x.title));
//         for (const it of byTitleTop) {
//           const key = it.url || it.title;
//           if (!seen.has(key)) { union.push(it); seen.add(key); }
//         }

//         if (union.length > 0) {
//           constrained = union;
//           console.log("[content] news constrained to asset:", sym, "count:", union.length);
//           break;
//         }
//       }
//     }

//     const finalNews = constrained ?? filtered;

//     newsItems = finalNews.map((n, idx) => ({
//       id: `news:${idx}:${safeHostname(n.url)}`,
//       title: n.title,
//       summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
//       url: n.url,
//       tags: ["news"],
//       assets: (n.currencies ?? []).map((c) => toSym(c.code || "")).filter(Boolean),
//       publishedAt: new Date(n.published_at),
//       source: n.source?.domain || safeHostname(n.url),
//     }));

//     console.log(
//       "[content] newsRaw:", newsRaw.length,
//       "filtered(broad):", filtered.length,
//       "finalNews:", newsItems.length
//     );

//     if (newsItems.length === 0 && newsRaw.length) {
//       newsItems = newsRaw.slice(0, 20).map((n, idx) => ({
//         id: `news:fallback:${idx}:${safeHostname(n.url)}`,
//         title: n.title,
//         summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
//         url: n.url,
//         tags: ["news"],
//         assets: (n.currencies ?? []).map((c) => toSym(c.code || "")).filter(Boolean),
//         publishedAt: new Date(n.published_at),
//         source: n.source?.domain || safeHostname(n.url),
//       }));
//       console.warn("[content] newsItems fell back to raw slice due to empty constrained set.");
//     }
//   } catch (e) {
//     console.warn("[content] cryptopanic failed:", (e as any)?.message || e);
//   }
// /* -------- 3) AI INSIGHT — use the raw highest contentScores key -------- */
// let insights: ContentItem[] = [];
// try {
//   const profileForRank = {
//     assets,
//     contentPrefs,
//     investorType: (user.onboarding as any)?.investorType ?? "",
//     assetScores,
//     contentScores,
//   };

//   // ✅ Step 1: find the exact key with the highest score
//   const [topKey, topScore] =
//     Object.entries(contentScores).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0] || [];

//   console.log("[content] AI topKey from contentScores =", topKey, "score=", topScore);

//   if (topKey) {
//     // ✅ Step 2: build a synthetic “content item” representing this category
//     const aiKey = `ai-topkey:${topKey}`;
//     const aiId = `insight:ai:v2:${keyToSlug(topKey)}:${hashId(aiKey)}`;

//     const sys = {
//       role: "system" as const,
//       content:
//         "You are a crypto market analyst. Be concise, specific, and practical. " +
//         "Output <= 120 words, neutral tone, 2–3 bullet points, then a one-line takeaway that starts with 'Takeaway:'. " +
//         "Do NOT give financial advice or mention that you are an AI.",
//     };

//     const usr = {
//       role: "user" as const,
//       content:
//         `Focus only on this content category:\n` +
//         `Category: ${topKey}\n` +
//         `Score: ${topScore}\n` +
//         "\nTask: Provide 2–3 bullets about why this category matters right now, " +
//         "then add a single 'Takeaway:' line.",
//     };

//     const ai = await chatFree([sys, usr]);
//     if (ai) {
//       insights = [{
//         id: aiId,
//         title: `AI Insight: ${topKey}`,
//         summary: ai,
//         url: undefined,
//         tags: ["insight"],
//         assets: [],
//         publishedAt: new Date(),
//         source: "OpenRouter (free)",
//       }];
//     }
//     console.log("[content] ai insight produced for topKey:", topKey);
//   }
// } catch (e) {
//   console.warn("[content] ai insight failed:", (e as any)?.message || e);
// }


//   // Fallbacks (no per-item hard-block checks)
//   if (insights.length === 0) {
//     if (newsItems.length) {
//       const first = newsItems[0];
//       const newsKey = `news|${first.url || first.title}`;
//       const newsInsightId = `insight:news:${hashId(newsKey)}`;

//       insights = [{
//         id: newsInsightId,
//         title: "Market Narrative Snapshot",
//         summary:
//           `• Notable story: ${first.title}\n` +
//           `• Source: ${first.source ?? "News"}\n` +
//           `Takeaway: Watch sentiment from leading outlets; avoid overreacting to a single headline.`,
//         url: first.url,
//         tags: ["insight"],
//         assets: assets.slice(0, 3),
//         publishedAt: new Date(),
//         source: first.source ?? "News",
//       }];
//       console.log("[content] fallback insight from news created (stable id)");
//     }
//   }

//   if (insights.length === 0 && priceItems.length) {
//     const marketsLike = priceItems.map((p) => ({
//       id: p.id.replace("price:", ""),
//       symbol: p.assets[0],
//       name: p.title.split(" (")[0],
//       pct: Number(/\((-?\d+(\.\d+)?)% 24h\)/.exec(p.title)?.[1] ?? "0"),
//       url: p.url,
//     }));
//     const sorted = marketsLike.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
//     const chosen = sorted[0];

//     if (chosen) {
//       const up = chosen.pct >= 0;
//       const priceId = `insight:price:${chosen.id}`;
//       insights = [{
//         id: priceId,
//         title: `${chosen.name} ${up ? "up" : "down"} ${chosen.pct.toFixed(2)}% over 24h`,
//         summary:
//           `Quick take: ${chosen.symbol} moved ${chosen.pct.toFixed(2)}% today.\n` +
//           `Takeaway: Volatility clusters—size positions and risk accordingly.`,
//         url: chosen.url,
//         tags: ["insight"],
//         assets: [chosen.symbol],
//         publishedAt: new Date(),
//         source: "CoinGecko",
//       }];
//       console.log("[content] fallback insight from prices created (stable id)");
//     }
//   }

//   return {
//     assets,
//     contentPrefs,
//     priceItems,
//     newsItems,
//     insights,
//     profile: {
//       assets,
//       contentPrefs,
//       investorType: (user.onboarding as any)?.investorType ?? "",
//       assetScores,
//       contentScores,
//     },
//   };
// }

// /* ---------------- public API ---------------- */

// export async function getCuratedFeed(userId: string): Promise<{
//   items: ContentItem[];
//   ranked: RankedFeed;
// }> {
//   const ts = new Date().toISOString();
//   const { assets, contentPrefs, priceItems, newsItems, insights, profile } =
//     await buildAllContent(userId);

//   let all: ContentItem[] = [...priceItems, ...newsItems, ...insights];

//   // TAG-AWARE DEDUPE: allow same URL once per tag (so News+Insight can share a link)
//   const seenTagUrl = new Set<string>();
//   all = all.filter((i) => {
//     const key = `${primaryTag(i)}|${i.url || i.id}`;
//     if (seenTagUrl.has(key)) return false;
//     seenTagUrl.add(key);
//     return true;
//   });

//   // Compute scored ordering
//   const scoredAll = rankWithScores(all, {
//     assets,
//     contentPrefs,
//     investorType: profile.investorType,
//     assetScores: profile.assetScores,
//     contentScores: profile.contentScores,
//   });

//   const byTag = (t: ContentTag) =>
//     scoredAll.filter((x) => x.tags.includes(t)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

//   const ranked: RankedFeed = {
//     news: byTag("news"),
//     prices: byTag("prices"),
//     insight: byTag("insight"),
//   };

//   const items = scoredAll.slice(0, 8);

//   console.log(
//     `[content ${ts}] feed built for user=${userId} :: total=${scoredAll.length} news=${ranked.news.length} prices=${ranked.prices.length} insight=${ranked.insight.length}`
//   );

//   return { items, ranked };
// }

// export async function getCuratedContent(userId: string): Promise<ContentItem[]> {
//   const { items } = await getCuratedFeed(userId);
//   return items;
// }
// src/services/content_service.ts
import userModel from "../models/users_model";
import { getMarketsByAssets } from "./vendor/coingecko";
import { getDailyNews } from "./vendor/cryptopanic";
import { freeRerank, RankItem } from "./vendor/free_rerank";
import { chatFree } from "./vendor/openrouter";

/* ---------------- types ---------------- */
export type ContentTag = "news" | "prices" | "insight";
export interface ContentItem {
  id: string;
  title: string;
  summary: string;
  url?: string;
  tags: ContentTag[];
  assets: string[];
  publishedAt?: Date;
  source?: string;
  score?: number; // derived score used for ordering
}

export interface RankedFeed {
  news: ContentItem[];
  prices: ContentItem[];
  insight: ContentItem[];
}

/* ---------------- utils ---------------- */
function scoresFromMaybeMap(m: any): Record<string, number> {
  if (!m) return {};
  try {
    if (typeof (m as any).get === "function" && typeof (m as any).entries === "function") {
      return Object.fromEntries(Array.from((m as any).entries()));
    }
    if (typeof m === "object") return { ...(m as Record<string, number>) };
  } catch {}
  return {};
}
function safeHostname(u?: string): string {
  if (!u) return "unknown";
  try { return new URL(u).hostname; } catch { return "unknown"; }
}
const toSym = (s: string) => String(s || "").trim().toUpperCase();

// Tiny deterministic hash for stable IDs
function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const SYMBOL_SYNONYMS: Record<string, string[]> = {
  BTC: ["BTC", "BITCOIN"], ETH: ["ETH", "ETHEREUM"], ADA: ["ADA", "CARDANO"],
  SOL: ["SOL", "SOLANA"], AVAX: ["AVAX", "AVALANCHE"], BNB: ["BNB", "BINANCE COIN", "BINANCECOIN"],
  DOGE: ["DOGE", "DOGECOIN"], XRP: ["XRP", "RIPPLE"], LTC: ["LTC", "LITECOIN"],
  DOT: ["DOT", "POLKADOT"], LINK: ["LINK", "CHAINLINK"], MATIC: ["MATIC", "POLYGON"],
  SHIB: ["SHIB", "SHIBA INU"], ARB: ["ARB", "ARBITRUM"], OP: ["OP", "OPTIMISM"],
};

function keywordRegexForAssets(assets: string[]): RegExp | null {
  const kws = assets
    .flatMap((s) => SYMBOL_SYNONYMS[s] ?? [s])
    .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!kws.length) return null;
  return new RegExp(`\\b(${kws.join("|")})\\b`, "i");
}

const primaryTag = (it: ContentItem): ContentTag =>
  it.tags.includes("news") ? "news" : it.tags.includes("insight") ? "insight" : "prices";

// 🔧 NEW: sort assets by score desc (default baseline 100 if missing)
function sortAssetsByScore(assets: string[], assetScores: Record<string, number>): string[] {
  return [...(assets ?? [])].sort((a, b) => {
    const sa = Number.isFinite(assetScores[a]) ? assetScores[a] : 100;
    const sb = Number.isFinite(assetScores[b]) ? assetScores[b] : 100;
    return sb - sa;
  });
}

// 🔧 pick the highest-scoring asset from user's assets
function pickTopAsset(assets: string[], assetScores: Record<string, number>): string | undefined {
  return sortAssetsByScore(assets, assetScores)[0];
}

function keyToSlug(k: string): string {
  return String(k).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// 🔧 helper: choose top content tag strictly from contentScores map (kept for future use)
function topContentTagFromScores(scores: Record<string, number>): ContentTag {
  const CANDIDATES: ContentTag[] = ["news", "prices", "insight"];
  const entries = Object.entries(scores).filter(([k]) => (CANDIDATES as string[]).includes(k));
  if (!entries.length) return "news";
  entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  return entries[0][0] as ContentTag;
}

/* ---------------- NEW: ensure Market News always has an asset ---------------- */
/**
 * Try currencies first; if empty, detect from title using the user's assets (by score order);
 * if still empty, fall back to the user's top asset; else return [].
 */
function inferNewsAssets(
  title: string | undefined,
  currencies: Array<{ code?: string }> | undefined,
  userAssetsByScore: string[]
): string[] {
  // 1) from CryptoPanic currencies
  const fromCurrencies = (currencies ?? [])
    .map((c) => toSym(String(c?.code || "")))
    .filter(Boolean);
  if (fromCurrencies.length) return [fromCurrencies[0]];

  // 2) detect from title using synonyms of the user's assets (score order)
  const ttl = String(title || "");
  for (const sym of userAssetsByScore) {
    const syns = SYMBOL_SYNONYMS[sym] ?? [sym];
    const rx = new RegExp(`\\b(${syns.map(s => s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|")})\\b`, "i");
    if (rx.test(ttl)) return [sym];
  }

  // 3) final fallback: top user asset
  if (userAssetsByScore.length) return [userAssetsByScore[0]];

  // 4) nothing
  return [];
}

/* ---------------- ranking with special case for insights ---------------- */
function rankWithScores(
  items: ContentItem[],
  profile: {
    assets: string[];
    contentPrefs: ContentTag[];
    investorType: string;
    assetScores: Record<string, number>;
    contentScores: Record<string, number>;
  }
): ContentItem[] {
  if (!items.length) return [];

  const rankables: RankItem[] = items.map((t) => ({
    id: t.id,
    title: t.title,
    summary: t.summary,
    tags: t.tags,
    assets: t.assets,
    url: t.url,
    publishedAt: t.publishedAt,
    source: t.source,
  }));

  const ranked = freeRerank(rankables, profile);
  const byId = new Map(items.map((i) => [i.id, i]));
  const N = ranked.length;

  const withScores: ContentItem[] = ranked.map((r, idx) => {
    const base = byId.get(r.id) || (r as unknown as ContentItem);
    if (base.tags.includes("insight")) {
      // ✅ Your requirement: Insights always have fixed score 1
      return { ...base, score: 1 };
    }
    return { ...base, score: N - idx };
  });

  withScores.sort((a, b) => {
    const s = (b.score ?? 0) - (a.score ?? 0);
    if (s !== 0) return s;
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });

  return withScores;
}

/* ---------------- core builder ---------------- */
async function buildAllContent(userId: string): Promise<{
  assets: string[];
  contentPrefs: ContentTag[];
  priceItems: ContentItem[];
  newsItems: ContentItem[];
  insights: ContentItem[];
  profile: {
    assets: string[];
    contentPrefs: ContentTag[];
    investorType: string;
    assetScores: Record<string, number>;
    contentScores: Record<string, number>;
  };
}> {
  const user = await userModel.findById(userId).lean();
  const empty = {
    assets: [],
    contentPrefs: [],
    priceItems: [] as ContentItem[],
    newsItems: [] as ContentItem[],
    insights: [] as ContentItem[],
    profile: {
      assets: [] as string[],
      contentPrefs: [] as ContentTag[],
      investorType: "",
      assetScores: {} as Record<string, number>,
      contentScores: {} as Record<string, number>,
    },
  };
  if (!user) return empty;

  const assets = (user.onboarding?.assets ?? []).map(toSym);
  const contentPrefs = (user.onboarding?.contentPrefs ?? []) as ContentTag[];
  const assetScores = scoresFromMaybeMap(user.recommendationProfile?.assetScores);
  const contentScores = scoresFromMaybeMap(user.recommendationProfile?.contentScores);

  // assets by score (desc)
  const assetsByScore = sortAssetsByScore(assets, assetScores);
  const topAsset = assetsByScore[0];
  console.log("[content] user assets:", assets, "assetsByScore:", assetsByScore);

  /* -------- 1) PRICES (try top → next → ...) -------- */
  let priceItems: ContentItem[] = [];
  try {
    if (assetsByScore.length) {
      let found: any[] | null = null;
      let usedSymbol: string | null = null;

      for (const sym of assetsByScore) {
        const markets = await getMarketsByAssets([sym]);
        const filt = markets.filter((m) => (m.symbol || "").toUpperCase() === sym);
        if (filt.length) {
          found = filt;
          usedSymbol = sym;
          break;
        }
      }

      const finalMarkets = found ?? (await getMarketsByAssets(assets));

      priceItems = finalMarkets.map((m) => ({
        id: `price:${m.id}`,
        title: `${m.name} (${m.symbol.toUpperCase()}): $${m.current_price.toLocaleString()} (${m.price_change_percentage_24h?.toFixed?.(2)}% 24h)`,
        summary: `24h: ${m.price_change_percentage_24h?.toFixed?.(2)}% • Rank: ${m.market_cap_rank ?? "?"}`,
        url: `https://www.coingecko.com/en/coins/${m.id}`,
        tags: ["prices"],
        assets: [m.symbol.toUpperCase()],
        publishedAt: new Date(),
        source: "CoinGecko",
      }));

      console.log("[content] prices picked for:", usedSymbol ?? "fallback:all", "count:", priceItems.length);
    } else {
      const markets = await getMarketsByAssets([]);
      priceItems = markets.map((m) => ({
        id: `price:${m.id}`,
        title: `${m.name} (${m.symbol.toUpperCase()}): $${m.current_price.toLocaleString()} (${m.price_change_percentage_24h?.toFixed?.(2)}% 24h)`,
        summary: `24h: ${m.price_change_percentage_24h?.toFixed?.(2)}% • Rank: ${m.market_cap_rank ?? "?"}`,
        url: `https://www.coingecko.com/en/coins/${m.id}`,
        tags: ["prices"],
        assets: [m.symbol.toUpperCase()],
        publishedAt: new Date(),
        source: "CoinGecko",
      }));
    }
  } catch (e) {
    console.warn("[content] coingecko failed:", (e as any)?.message || e);
  }

  /* -------- 2) NEWS (daily cached; resilient; try top → next → ...) -------- */
  let newsItems: ContentItem[] = [];
  try {
    const newsRaw = await getDailyNews(80);

    // Broad filter (existing logic)
    let filtered = assets.length
      ? newsRaw.filter((n) =>
          (n.currencies ?? []).some((c) => assets.includes(toSym(c.code || ""))))
      : newsRaw;

    if (assets.length) {
      const rx = keywordRegexForAssets(assets);
      if (rx && filtered.length < 6) {
        const byTitle = newsRaw.filter((n) => rx.test(n.title || ""));
        const seen = new Set<string>(filtered.map((x) => x.url || x.title));
        for (const it of byTitle) {
          const key = it.url || it.title;
          if (!seen.has(key)) { filtered.push(it); seen.add(key); }
        }
      }
    }

    if (filtered.length === 0) filtered = newsRaw.slice(0, 20);

    // Try to constrain to each asset in score order; pick first that yields results
    let constrained: typeof filtered | null = null;
    if (assetsByScore.length) {
      for (const sym of assetsByScore) {
        const rxTop = keywordRegexForAssets([sym]);
        const strictByCurrency = filtered.filter((n) =>
          (n.currencies ?? []).some((c) => toSym(c.code || "") === sym)
        );
        const byTitleTop = rxTop ? filtered.filter((n) => rxTop.test(n.title || "")) : [];

        // union unique (by url/title)
        const union = [...strictByCurrency];
        const seen = new Set<string>(union.map((x) => x.url || x.title));
        for (const it of byTitleTop) {
          const key = it.url || it.title;
          if (!seen.has(key)) { union.push(it); seen.add(key); }
        }

        if (union.length > 0) {
          constrained = union;
          console.log("[content] news constrained to asset:", sym, "count:", union.length);
          break;
        }
      }
    }

    const finalNews = constrained ?? filtered;

    // ✅ NEW: ensure each news item has at least one asset for feedback to update DB
    newsItems = finalNews.map((n, idx) => {
      const assetsForNews = inferNewsAssets(n.title, n.currencies, assetsByScore);
      if (assetsForNews.length === 0) {
        console.warn("[content] news item has no assets even after inference:", n.title);
      }
      return {
        id: `news:${idx}:${safeHostname(n.url)}`,
        title: n.title,
        summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
        url: n.url,
        tags: ["news"],
        assets: assetsForNews, // <-- 🔑 ensures feedback always has a symbol to $inc
        publishedAt: new Date(n.published_at),
        source: n.source?.domain || safeHostname(n.url),
      } as ContentItem;
    });

    console.log(
      "[content] newsRaw:", newsRaw.length,
      "filtered(broad):", filtered.length,
      "finalNews:", newsItems.length
    );

    if (newsItems.length === 0 && newsRaw.length) {
      newsItems = newsRaw.slice(0, 20).map((n, idx) => ({
        id: `news:fallback:${idx}:${safeHostname(n.url)}`,
        title: n.title,
        summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
        url: n.url,
        tags: ["news"],
        assets: inferNewsAssets(n.title, n.currencies, assetsByScore),
        publishedAt: new Date(n.published_at),
        source: n.source?.domain || safeHostname(n.url),
      }));
      console.warn("[content] newsItems fell back to raw slice due to empty constrained set.");
    }
  } catch (e) {
    console.warn("[content] cryptopanic failed:", (e as any)?.message || e);
  }

  /* -------- 3) AI INSIGHT — use the raw highest contentScores key -------- */
  let insights: ContentItem[] = [];
  try {
    const profileForRank = {
      assets,
      contentPrefs,
      investorType: (user.onboarding as any)?.investorType ?? "",
      assetScores,
      contentScores,
    };

    // Step 1: find the exact key with the highest score
    const [topKey, topScore] =
      Object.entries(contentScores).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0] || [];

    console.log("[content] AI topKey from contentScores =", topKey, "score=", topScore);

    if (topKey) {
      // Step 2: build a synthetic “content item” representing this category
      const aiKey = `ai-topkey:${topKey}`;
      const aiId = `insight:ai:v2:${keyToSlug(topKey)}:${hashId(aiKey)}`;

      const sys = {
        role: "system" as const,
        content:
          "You are a crypto market analyst. Be concise, specific, and practical. " +
          "Output <= 120 words, neutral tone, 2–3 bullet points, then a one-line takeaway that starts with 'Takeaway:'. " +
          "Do NOT give financial advice or mention that you are an AI.",
      };

      const usr = {
        role: "user" as const,
        content:
          `Focus only on this content category:\n` +
          `Category: ${topKey}\n` +
          `Score: ${topScore}\n` +
          "\nTask: Provide 2–3 bullets about why this category matters right now, " +
          "then add a single 'Takeaway:' line.",
      };

      const ai = await chatFree([sys, usr]);
      if (ai) {
        insights = [{
          id: aiId,
          title: `AI Insight: ${topKey}`,
          summary: ai,
          url: undefined,
          tags: ["insight"],
          assets: [],
          publishedAt: new Date(),
          source: "OpenRouter (free)",
        }];
      }
      console.log("[content] ai insight produced for topKey:", topKey);
    }
  } catch (e) {
    console.warn("[content] ai insight failed:", (e as any)?.message || e);
  }

  // Fallbacks (no per-item hard-block checks)
  if (insights.length === 0) {
    if (newsItems.length) {
      const first = newsItems[0];
      const newsKey = `news|${first.url || first.title}`;
      const newsInsightId = `insight:news:${hashId(newsKey)}`;

      insights = [{
        id: newsInsightId,
        title: "Market Narrative Snapshot",
        summary:
          `• Notable story: ${first.title}\n` +
          `• Source: ${first.source ?? "News"}\n` +
          `Takeaway: Watch sentiment from leading outlets; avoid overreacting to a single headline.`,
        url: first.url,
        tags: ["insight"],
        assets: assets.slice(0, 3),
        publishedAt: new Date(),
        source: first.source ?? "News",
      }];
      console.log("[content] fallback insight from news created (stable id)");
    }
  }

  if (insights.length === 0 && priceItems.length) {
    const marketsLike = priceItems.map((p) => ({
      id: p.id.replace("price:", ""),
      symbol: p.assets[0],
      name: p.title.split(" (")[0],
      pct: Number(/\((-?\d+(\.\d+)?)% 24h\)/.exec(p.title)?.[1] ?? "0"),
      url: p.url,
    }));
    const sorted = marketsLike.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    const chosen = sorted[0];

    if (chosen) {
      const up = chosen.pct >= 0;
      const priceId = `insight:price:${chosen.id}`;
      insights = [{
        id: priceId,
        title: `${chosen.name} ${up ? "up" : "down"} ${chosen.pct.toFixed(2)}% over 24h`,
        summary:
          `Quick take: ${chosen.symbol} moved ${chosen.pct.toFixed(2)}% today.\n` +
          `Takeaway: Volatility clusters—size positions and risk accordingly.`,
        url: chosen.url,
        tags: ["insight"],
        assets: [chosen.symbol],
        publishedAt: new Date(),
        source: "CoinGecko",
      }];
      console.log("[content] fallback insight from prices created (stable id)");
    }
  }

  return {
    assets,
    contentPrefs,
    priceItems,
    newsItems,
    insights,
    profile: {
      assets,
      contentPrefs,
      investorType: (user.onboarding as any)?.investorType ?? "",
      assetScores,
      contentScores,
    },
  };
}

/* ---------------- public API ---------------- */

export async function getCuratedFeed(userId: string): Promise<{
  items: ContentItem[];
  ranked: RankedFeed;
}> {
  const ts = new Date().toISOString();
  const { assets, contentPrefs, priceItems, newsItems, insights, profile } =
    await buildAllContent(userId);

  let all: ContentItem[] = [...priceItems, ...newsItems, ...insights];

  // TAG-AWARE DEDUPE: allow same URL once per tag (so News+Insight can share a link)
  const seenTagUrl = new Set<string>();
  all = all.filter((i) => {
    const key = `${primaryTag(i)}|${i.url || i.id}`;
    if (seenTagUrl.has(key)) return false;
    seenTagUrl.add(key);
    return true;
  });

  // Compute scored ordering
  const scoredAll = rankWithScores(all, {
    assets,
    contentPrefs,
    investorType: profile.investorType,
    assetScores: profile.assetScores,
    contentScores: profile.contentScores,
  });

  const byTag = (t: ContentTag) =>
    scoredAll.filter((x) => x.tags.includes(t)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const ranked: RankedFeed = {
    news: byTag("news"),
    prices: byTag("prices"),
    insight: byTag("insight"),
  };

  const items = scoredAll.slice(0, 8);

  console.log(
    `[content ${ts}] feed built for user=${userId} :: total=${scoredAll.length} news=${ranked.news.length} prices=${ranked.prices.length} insight=${ranked.insight.length}`
  );

  return { items, ranked };
}

export async function getCuratedContent(userId: string): Promise<ContentItem[]> {
  const { items } = await getCuratedFeed(userId);
  return items;
}
