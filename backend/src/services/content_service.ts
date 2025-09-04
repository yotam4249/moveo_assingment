// import userModel from "../models/users_model";
// import { getMarketsByAssets } from "./vendor/coingecko";
// import { getDailyNews } from "./vendor/cryptopanic";
// import { freeRerank, RankItem } from "./vendor/free_rerank";

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
// }

// /* ---------------- util helpers ---------------- */
// function scoresFromMaybeMap(m: any): Record<string, number> {
//   if (!m) return {};
//   try {
//     if (typeof m.get === "function" && typeof m.entries === "function") {
//       return Object.fromEntries(Array.from(m.entries()));
//     }
//     if (typeof m === "object") return { ...m };
//   } catch {}
//   return {};
// }
// function safeHostname(u?: string): string {
//   if (!u) return "unknown";
//   try {
//     return new URL(u).hostname;
//   } catch {
//     return "unknown";
//   }
// }
// const toSym = (s: string) => s.trim().toUpperCase();

// /** Synonyms to catch news items with no `currencies` tag */
// const SYMBOL_SYNONYMS: Record<string, string[]> = {
//   BTC: ["BTC", "BITCOIN"],
//   ETH: ["ETH", "ETHEREUM"],
//   ADA: ["ADA", "CARDANO"],
//   SOL: ["SOL", "SOLANA"],
//   AVAX: ["AVAX", "AVALANCHE"],
//   BNB: ["BNB", "BINANCE COIN", "BINANCECOIN"],
//   DOGE: ["DOGE", "DOGECOIN"],
//   XRP: ["XRP", "RIPPLE"],
//   LTC: ["LTC", "LITECOIN"],
//   DOT: ["DOT", "POLKADOT"],
//   LINK: ["LINK", "CHAINLINK"],
//   MATIC: ["MATIC", "POLYGON"],
//   SHIB: ["SHIB", "SHIBA INU"],
//   ARB: ["ARB", "ARBITRUM"],
//   OP: ["OP", "OPTIMISM"],
// };

// function keywordRegexForAssets(assets: string[]): RegExp | null {
//   const kws = assets
//     .flatMap((s) => SYMBOL_SYNONYMS[s] ?? [s])
//     .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
//   if (!kws.length) return null;
//   return new RegExp(`\\b(${kws.join("|")})\\b`, "i");
// }

// /* ---------------- core ---------------- */
// export async function getCuratedContent(userId: string): Promise<ContentItem[]> {
//   try {
//     const user = await userModel.findById(userId).lean();
//     if (!user) return [];

//     const assets = (user.onboarding?.assets ?? []).map(toSym);
//     const contentPrefs = (user.onboarding?.contentPrefs ?? []) as ContentTag[];
//     const assetScores = scoresFromMaybeMap(user.recommendationProfile?.assetScores);
//     const contentScores = scoresFromMaybeMap(user.recommendationProfile?.contentScores);

//     /* -------- 1) PRICES -------- */
//     let priceItems: ContentItem[] = [];
//     try {
//       const markets = await getMarketsByAssets(assets);
//       priceItems = markets.map((m) => ({
//         id: `price:${m.id}`,
//         title: `${m.name} (${m.symbol.toUpperCase()}): $${m.current_price.toLocaleString()} (${m.price_change_percentage_24h?.toFixed?.(
//           2
//         )}% 24h)`,
//         summary: `24h: ${m.price_change_percentage_24h?.toFixed?.(2)}% • Rank: ${
//           m.market_cap_rank ?? "?"
//         }`,
//         url: `https://www.coingecko.com/en/coins/${m.id}`,
//         tags: ["prices"],
//         assets: [m.symbol.toUpperCase()],
//         publishedAt: new Date(),
//         source: "CoinGecko",
//       }));
//     } catch (e) {
//       console.warn("[content] coingecko failed:", (e as any)?.message || e);
//     }

//     /* -------- 2) NEWS (daily cached, tolerant filtering) -------- */
//     let newsItems: ContentItem[] = [];
//     try {
//       const newsRaw = await getDailyNews(80); // global cache (vendor layer)

//       // A) strict match using CryptoPanic currencies
//       let filtered = assets.length
//         ? newsRaw.filter((n) =>
//             (n.currencies ?? []).some((c) => assets.includes(toSym(c.code || "")))
//           )
//         : newsRaw;

//       // B) keyword match by title if strict match thin
//       if (assets.length) {
//         const rx = keywordRegexForAssets(assets);
//         if (rx && filtered.length < 6) {
//           const byTitle = newsRaw.filter((n) => rx.test(n.title || ""));
//           // merge unique by URL or title
//           const seen = new Set<string>(filtered.map((x) => x.url || x.title));
//           for (const it of byTitle) {
//             const key = it.url || it.title;
//             if (!seen.has(key)) {
//               filtered.push(it);
//               seen.add(key);
//             }
//           }
//         }
//       }

//       // C) top global fallback
//       if (filtered.length === 0) filtered = newsRaw.slice(0, 20);

//       newsItems = filtered.map((n, idx) => ({
//         id: `news:${idx}:${safeHostname(n.url)}`,
//         title: n.title,
//         summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
//         url: n.url,
//         tags: ["news"],
//         assets: (n.currencies ?? []).map((c) => toSym(c.code || "")).filter(Boolean),
//         publishedAt: new Date(n.published_at),
//         source: n.source?.domain || safeHostname(n.url),
//       }));

//       console.log(
//         "[content] newsRaw:",
//         newsRaw.length,
//         "filtered:",
//         filtered.length,
//         "newsItems:",
//         newsItems.length
//       );

//       // D) absolute last resort: if we got raw but mapped to 0, show a raw slice
//       if (newsItems.length === 0 && newsRaw.length) {
//         newsItems = newsRaw.slice(0, 20).map((n, idx) => ({
//           id: `news:fallback:${idx}:${safeHostname(n.url)}`,
//           title: n.title,
//           summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
//           url: n.url,
//           tags: ["news"],
//           assets: (n.currencies ?? []).map((c) => toSym(c.code || "")).filter(Boolean),
//           publishedAt: new Date(n.published_at),
//           source: n.source?.domain || safeHostname(n.url),
//         }));
//         console.warn("[content] newsItems fell back to raw slice due to empty filtered set.");
//       }
//     } catch (e) {
//       console.warn("[content] cryptopanic failed:", (e as any)?.message || e);
//     }

//     /* -------- 3) INSIGHTS -------- */
//     let insights: ContentItem[] = newsItems
//       .filter((n) => /\b(analysis|insight|on-chain|opinion|explainer|macro)\b/i.test(n.title))
//       .map((n) => ({
//         ...n,
//         id: n.id.replace("news:", "insight:"),
//         tags: ["insight"] as ContentTag[],
//       }));

//     // If no insight-y news, synthesize an insight from price action
//     if (insights.length === 0 && priceItems.length) {
//       const marketsLike = priceItems.map((p) => ({
//         id: p.id.replace("price:", ""),
//         symbol: p.assets[0],
//         name: p.title.split(" (")[0],
//         pct: Number(/\((-?\d+(\.\d+)?)% 24h\)/.exec(p.title)?.[1] ?? "0"),
//         url: p.url,
//       }));
//       const topMove = marketsLike.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
//       if (topMove) {
//         const up = topMove.pct >= 0;
//         insights = [
//           {
//             id: `insight:price:${topMove.id}`,
//             title: `${topMove.name} ${up ? "up" : "down"} ${topMove.pct.toFixed(2)}% over 24h`,
//             summary: `Quick take: ${topMove.symbol} moved ${topMove.pct.toFixed(
//               2
//             )}% today. Check recent headlines and order flow for context.`,
//             url: topMove.url,
//             tags: ["insight"],
//             assets: [topMove.symbol],
//             publishedAt: new Date(),
//             source: "CoinGecko",
//           },
//         ];
//       }
//     }

//     /* -------- Merge + de-duplicate -------- */
//     let all: ContentItem[] = [...priceItems, ...newsItems, ...insights];
//     const seen = new Set<string>();
//     all = all.filter((i) => {
//       const key = i.url || i.id;
//       if (seen.has(key)) return false;
//       seen.add(key);
//       return true;
//     });

//     /* -------- Rank -------- */
//     const rankables: RankItem[] = all.map((t) => ({
//       id: t.id,
//       title: t.title,
//       summary: t.summary,
//       tags: t.tags,
//       assets: t.assets,
//       url: t.url,
//       publishedAt: t.publishedAt,
//       source: t.source,
//     }));

//     const ranked = freeRerank(rankables, {
//       assets,
//       contentPrefs,
//       investorType: user.onboarding?.investorType ?? "",
//       assetScores,
//       contentScores,
//     });

//     const byId = new Map(all.map((a) => [a.id, a]));
//     const finalItems = ranked.map((r) => byId.get(r.id) || r);

//     return finalItems.slice(0, 8);
//   } catch (e) {
//     console.error("[content] fatal:", (e as any)?.message || e);
//     return [];
//   }
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
}

/* ---------------- utils ---------------- */
function scoresFromMaybeMap(m: any): Record<string, number> {
  if (!m) return {};
  try {
    if (typeof m.get === "function" && typeof m.entries === "function") {
      return Object.fromEntries(Array.from(m.entries()));
    }
    if (typeof m === "object") return { ...m };
  } catch {}
  return {};
}
function safeHostname(u?: string): string {
  if (!u) return "unknown";
  try { return new URL(u).hostname; } catch { return "unknown"; }
}
const toSym = (s: string) => s.trim().toUpperCase();

const SYMBOL_SYNONYMS: Record<string, string[]> = {
  BTC: ["BTC", "BITCOIN"], ETH: ["ETH", "ETHEREUM"], ADA: ["ADA", "CARDANO"],
  SOL: ["SOL", "SOLANA"], AVAX: ["AVAX", "AVALANCHE"], BNB: ["BNB", "BINANCE COIN", "BINANCECOIN"],
  DOGE: ["DOGE", "DOGECOIN"], XRP: ["XRP", "RIPPLE"], LTC: ["LTC", "LITECOIN"],
  DOT: ["DOT", "POLKADOT"], LINK: ["LINK", "CHAINLINK"], MATIC: ["MATIC", "POLYGON"],
  SHIB: ["SHIB", "SHIBA INU"], ARB: ["ARB", "ARBITRUM"], OP: ["OP", "OPTIMISM"],
};
function keywordRegexForAssets(assets: string[]): RegExp | null {
  const kws = assets.flatMap(s => SYMBOL_SYNONYMS[s] ?? [s]).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!kws.length) return null;
  return new RegExp(`\\b(${kws.join("|")})\\b`, "i");
}
const primaryTag = (it: ContentItem): ContentTag =>
  it.tags.includes("news") ? "news" : it.tags.includes("insight") ? "insight" : "prices";

/* ---------------- main ---------------- */
export async function getCuratedContent(userId: string): Promise<ContentItem[]> {
  try {
    const user = await userModel.findById(userId).lean();
    if (!user) return [];

    const assets = (user.onboarding?.assets ?? []).map(toSym);
    const contentPrefs = (user.onboarding?.contentPrefs ?? []) as ContentTag[];
    const assetScores = scoresFromMaybeMap(user.recommendationProfile?.assetScores);
    const contentScores = scoresFromMaybeMap(user.recommendationProfile?.contentScores);

    /* -------- 1) PRICES -------- */
    let priceItems: ContentItem[] = [];
    try {
      const markets = await getMarketsByAssets(assets);
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
    } catch (e) {
      console.warn("[content] coingecko failed:", (e as any)?.message || e);
    }

    /* -------- 2) NEWS (daily cached; vendor has RSS fallback) -------- */
    let newsItems: ContentItem[] = [];
    try {
      const newsRaw = await getDailyNews(80);

      // strict asset tag match
      let filtered = assets.length
        ? newsRaw.filter((n) =>
            (n.currencies ?? []).some((c) => assets.includes(toSym(c.code || ""))))
        : newsRaw;

      // keyword title match if thin
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

      newsItems = filtered.map((n, idx) => ({
        id: `news:${idx}:${safeHostname(n.url)}`,
        title: n.title,
        summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
        url: n.url,
        tags: ["news"],
        assets: (n.currencies ?? []).map((c) => toSym(c.code || "")).filter(Boolean),
        publishedAt: new Date(n.published_at),
        source: n.source?.domain || safeHostname(n.url),
      }));

      console.log("[content] newsRaw:", newsRaw.length, "filtered:", filtered.length, "newsItems:", newsItems.length);

      if (newsItems.length === 0 && newsRaw.length) {
        newsItems = newsRaw.slice(0, 20).map((n, idx) => ({
          id: `news:fallback:${idx}:${safeHostname(n.url)}`,
          title: n.title,
          summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
          url: n.url,
          tags: ["news"],
          assets: (n.currencies ?? []).map((c) => toSym(c.code || "")).filter(Boolean),
          publishedAt: new Date(n.published_at),
          source: n.source?.domain || safeHostname(n.url),
        }));
        console.warn("[content] newsItems fell back to raw slice due to empty filtered set.");
      }
    } catch (e) {
      console.warn("[content] cryptopanic failed:", (e as any)?.message || e);
    }

    /* -------- 3) AI INSIGHT (OpenRouter free) + robust fallbacks -------- */
    let insights: ContentItem[] = [];
    try {
      const topNews = (newsItems || []).slice(0, 6).map((n) => `• ${n.title}`).join("\n");
      const movers = (priceItems || []).slice(0, 4).map((p) => {
        const name = /^(.*?) \(/.exec(p.title)?.[1] || p.assets[0] || "Asset";
        const pct = /\((-?\d+(\.\d+)?)% 24h\)/.exec(p.title)?.[1] || "?";
        return `${name}: ${pct}%`;
      }).join(", ");
      const userFocus = assets.length ? assets.join(", ") : "broad market";

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
          `User focus: ${userFocus}\n` +
          `Top movers (24h): ${movers || "N/A"}\n` +
          `Recent headlines:\n${topNews || "N/A"}\n\n` +
          "Task: Produce a brief “Insight of the Day” with 2–3 bullets that synthesize price action + headlines. " +
          "End with a single takeaway line starting with 'Takeaway:'.",
      };

      const ai = await chatFree([sys, usr]);
      if (ai) {
        // IMPORTANT: give this a unique id *and* keep url (may equal top news)
        insights = [{
          id: `insight:ai:${Date.now()}`,
          title: "AI Insight of the Day",
          summary: ai,
          url: newsItems[0]?.url || priceItems[0]?.url, // can match news URL — that's fine now
          tags: ["insight"],
          assets: assets.slice(0, 3),
          publishedAt: new Date(),
          source: "OpenRouter (free)",
        }];
      }
      console.log("[content] ai insight produced:", Boolean(ai));
    } catch (e) {
      console.warn("[content] ai insight failed:", (e as any)?.message || e);
    }

    // Fallbacks to guarantee at least one insight
    if (insights.length === 0 && newsItems.length) {
      const first = newsItems[0];
      insights = [{
        id: `insight:news:${Date.now()}`,
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
      console.log("[content] fallback insight from news created");
    }
    if (insights.length === 0 && priceItems.length) {
      const marketsLike = priceItems.map((p) => ({
        id: p.id.replace("price:", ""),
        symbol: p.assets[0],
        name: p.title.split(" (")[0],
        pct: Number(/\((-?\d+(\.\d+)?)% 24h\)/.exec(p.title)?.[1] ?? "0"),
        url: p.url,
      }));
      const topMove = marketsLike.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
      if (topMove) {
        const up = topMove.pct >= 0;
        insights = [{
          id: `insight:price:${topMove.id}`,
          title: `${topMove.name} ${up ? "up" : "down"} ${topMove.pct.toFixed(2)}% over 24h`,
          summary:
            `Quick take: ${topMove.symbol} moved ${topMove.pct.toFixed(2)}% today.\n` +
            `Takeaway: Volatility clusters—size positions and risk accordingly.`,
          url: topMove.url,
          tags: ["insight"],
          assets: [topMove.symbol],
          publishedAt: new Date(),
          source: "CoinGecko",
        }];
        console.log("[content] fallback insight from prices created");
      }
    }

    /* -------- merge -------- */
    let all: ContentItem[] = [...priceItems, ...newsItems, ...insights];

    // TAG-AWARE DEDUPE: allow same URL to appear once per tag (so News + Insight can share a link)
    const seenTagUrl = new Set<string>();
    all = all.filter((i) => {
      const key = `${primaryTag(i)}|${i.url || i.id}`;
      if (seenTagUrl.has(key)) return false;
      seenTagUrl.add(key);
      return true;
    });

    /* -------- rank -------- */
    const rankables: RankItem[] = all.map((t) => ({
      id: t.id, title: t.title, summary: t.summary, tags: t.tags, assets: t.assets, url: t.url,
      publishedAt: t.publishedAt, source: t.source,
    }));
    const ranked = freeRerank(rankables, {
      assets, contentPrefs, investorType: user.onboarding?.investorType ?? "", assetScores, contentScores,
    });
    const byId = new Map(all.map((a) => [a.id, a]));
    const fullRanked: ContentItem[] = ranked.map(r => byId.get(r.id) || (r as any));

    /* -------- guaranteed mix: at least 1 news + 1 insight -------- */
    const N = 8;
    const chosen: ContentItem[] = [];
    const seenId = new Set<string>();
    const add = (it?: ContentItem) => {
      if (!it) return;
      if (seenId.has(it.id)) return;  // dedupe by ID ONLY here
      seenId.add(it.id);
      chosen.push(it);
    };

    add(newsItems[0]);     // ensure News
    add(insights[0]);      // ensure Insight

    for (const r of fullRanked) {
      add(r);
      if (chosen.length >= N) break;
    }

    const finalItems = chosen.slice(0, N);

    console.log(
      "[content] final counts => prices:", priceItems.length,
      "news:", newsItems.length,
      "insights:", insights.length,
      "final returned:", finalItems.length,
      "hasNews:", finalItems.some((x) => x.tags.includes("news")),
      "hasInsight:", finalItems.some((x) => x.tags.includes("insight"))
    );

    return finalItems;
  } catch (e) {
    console.error("[content] fatal:", (e as any)?.message || e);
    return [];
  }
}
