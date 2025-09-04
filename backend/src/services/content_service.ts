// src/services/content_service.ts
import userModel from "../models/users_model";
import { getMarketsByAssets } from "./vendor/coingecko";
import { getDailyNews } from "./vendor/cryptopanic";
import { freeRerank, RankItem } from "./vendor/free_rerank";

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

export async function getCuratedContent(userId: string): Promise<ContentItem[]> {
  try {
    const user = await userModel.findById(userId).lean();
    if (!user) return [];

    const assets = (user.onboarding?.assets ?? []).map((s: string) => s.toUpperCase());
    const contentPrefs = (user.onboarding?.contentPrefs ?? []) as ContentTag[];
    const assetScores = scoresFromMaybeMap(user.recommendationProfile?.assetScores);
    const contentScores = scoresFromMaybeMap(user.recommendationProfile?.contentScores);

    // ---- 1) Prices (CoinGecko) ----
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

    // ---- 2) News (CryptoPanic, daily global cache) ----
    let newsItems: ContentItem[] = [];
    try {
      const newsRaw = await getDailyNews(80); // single global fetch per 24h
      const filtered = assets.length
        ? newsRaw.filter((n) =>
            (n.currencies ?? []).some((c) => assets.includes((c.code || "").toUpperCase()))
          )
        : newsRaw;

      newsItems = filtered.map((n, idx) => ({
        id: `news:${idx}:${safeHostname(n.url)}`,
        title: n.title,
        summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
        url: n.url,
        tags: ["news"],
        assets: (n.currencies ?? []).map((c) => (c.code || "").toUpperCase()).filter(Boolean),
        publishedAt: new Date(n.published_at),
        source: n.source?.domain || safeHostname(n.url),
      }));
    } catch (e) {
      console.warn("[content] cryptopanic failed:", (e as any)?.message || e);
    }

    // ---- 3) Insights (simple heuristic from news) ----
    const insights = newsItems
      .filter((n) => /\b(analysis|insight|on-chain|opinion|explainer|macro)\b/i.test(n.title))
      .map((n) => ({ ...n, id: n.id.replace("news:", "insight:"), tags: (["insight"] as ContentTag[]) }));

    // ---- Merge + dedupe ----
    let all: ContentItem[] = [...priceItems, ...newsItems, ...insights];
    const seen = new Set<string>();
    all = all.filter((i) => {
      const key = i.url || i.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ---- Rank ----
    const rankables: RankItem[] = all.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary,
      tags: t.tags,
      assets: t.assets,
      url: t.url,
      publishedAt: t.publishedAt,
      source: t.source,
    }));

    const ranked = freeRerank(rankables, {
      assets,
      contentPrefs,
      investorType: user.onboarding?.investorType ?? "",
      assetScores,
      contentScores,
    });

    const byId = new Map(all.map((a) => [a.id, a]));
    const finalItems = ranked.map((r) => byId.get(r.id) || r);

    return finalItems.slice(0, 8);
  } catch (e) {
    console.error("[content] fatal:", (e as any)?.message || e);
    return [];
  }
}
