// src/services/content_service.ts
import userModel from "../models/users_model";
import { getMarketsByAssets } from "./vendor/coingecko";
import { getNewsForAssets } from "./vendor/cryptopanic";
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
    // אם זה Map של מונגוס:
    if (typeof m.get === "function" && typeof m.entries === "function") {
      return Object.fromEntries(Array.from(m.entries()));
    }
    // אם זה אובייקט רגיל:
    if (typeof m === "object") return { ...m };
  } catch {
    /* ignore */
  }
  return {};
}

export async function getCuratedContent(userId: string): Promise<ContentItem[]> {
  const user = await userModel.findById(userId).lean();
  if (!user) return [];

  const assets = (user.onboarding?.assets ?? []).map((s: string) => s.toUpperCase());
  const contentPrefs = (user.onboarding?.contentPrefs ?? []) as ContentTag[];

  const assetScores = scoresFromMaybeMap(user.recommendationProfile?.assetScores);
  const contentScores = scoresFromMaybeMap(user.recommendationProfile?.contentScores);

  // 1) מחירים/שוק (CoinGecko)
  const markets = await getMarketsByAssets(assets);
  const priceItems: ContentItem[] = markets.map((m) => ({
    id: `price:${m.id}`,
    title: `${m.name} (${m.symbol.toUpperCase()}): $${m.current_price.toLocaleString()} (${m.price_change_percentage_24h?.toFixed?.(2)}% 24h)`,
    summary: `24h: ${m.price_change_percentage_24h?.toFixed?.(2)}% • Rank: ${m.market_cap_rank ?? "?"}`,
    url: `https://www.coingecko.com/en/coins/${m.id}`,
    tags: ["prices"],
    assets: [m.symbol.toUpperCase()],
    publishedAt: new Date(),
    source: "CoinGecko",
  }));

  // 2) חדשות/כתבות (CryptoPanic)
  const newsRaw = await getNewsForAssets(assets, 30);
  const newsItems: ContentItem[] = newsRaw.map((n, idx) => ({
    id: `news:${idx}:${new URL(n.url).hostname}`,
    title: n.title,
    summary: `${n.source?.title ?? ""} – ${new Date(n.published_at).toLocaleString()}`,
    url: n.url,
    tags: ["news"],
    assets: (n.currencies ?? []).map((c) => c.code?.toUpperCase()).filter(Boolean),
    publishedAt: new Date(n.published_at),
    source: n.source?.domain,
  }));

  // 3) Insights — סינון פשוט לפי מילות מפתח בכותרת
  const insights = newsItems
    .filter((n) => /\b(analysis|insight|on-chain|opinion|explainer|macro)\b/i.test(n.title))
    .map((n) => ({ ...n, id: n.id.replace("news:", "insight:"), tags: (["insight"] as ContentTag[]) }));

  // איחוד וניקוי כפילויות לפי URL
  let all: ContentItem[] = [...priceItems, ...newsItems, ...insights];
  const seen = new Set<string>();
  all = all.filter((i) => {
    const key = i.url || i.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // המרה ל־RankItem → ריראנק חינמי → בחירת טופ N
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

  // החזרה ל־ContentItem ושמירה על השדות
  const byId = new Map(all.map((a) => [a.id, a]));
  const finalItems = ranked.map((r) => byId.get(r.id) || r);

  return finalItems.slice(0, 8);
}
