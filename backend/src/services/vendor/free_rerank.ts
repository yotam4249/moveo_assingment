// src/services/vendor/free_rerank.ts

import { ContentTag } from "../content_service";

export type RankItem = {
  id: string;
  title: string;
  summary: string;
  tags: ContentTag[];   // ["news" | "prices" | "insight"]
  assets: string[];     // ["BTC","ETH"...]
  url?: string;
  publishedAt?: Date;
  source?: string;
};

export type Profile = {
  assets: string[];
  contentPrefs: string[]; // NOTE: if your prefs are free-form, you'll likely map them to tags elsewhere
  investorType?: string;
  assetScores: Record<string, number>;   // baseline 100
  contentScores: Record<string, number>; // baseline 100
};

function freshnessBoost(d?: Date) {
  if (!d) return 0;
  const hours = (Date.now() - d.getTime()) / 36e5;
  if (hours <= 6)  return 2;
  if (hours <= 24) return 1.2;
  if (hours <= 48) return 0.7;
  return 0.2;
}

function priceHeuristic(title: string) {
  if (/(\+|\-)\d+(\.\d+)?%/.test(title)) return 1.0; // explicit % moves
  if (/break(out|down)|rally|dump|spike/i.test(title)) return 0.8;
  return 0.3;
}

export function freeRerank(items: RankItem[], profile: Profile): RankItem[] {
  const { assets, contentPrefs, assetScores, contentScores } = profile;

  const scored = items.map((x) => {
    let s = 0;

    // Tag overlap (simple preference match on tags)
    const tagMatches = x.tags.filter((t) => contentPrefs.includes(t)).length;
    s += tagMatches * 2;

    // Asset overlap (user-selected focus assets)
    const assetOverlap = x.assets.filter((a) => assets.includes(a)).length;
    s += assetOverlap * 2;

    // Feedback history — baseline 100 is neutral; each vote shifts by ±1 exactly
    for (const a of x.assets) {
      const delta = (assetScores[a] ?? 100) - 100; // ... -1, 0, +1, ...
      s += delta * 1; // <- EXACT +1/-1 contribution per vote
    }
    for (const t of x.tags) {
      const delta = (contentScores[t] ?? 100) - 100;
      s += delta * 1; // <- EXACT +1/-1 contribution per vote
    }

    // Recency and price-title heuristic
    s += freshnessBoost(x.publishedAt);
    if (x.tags.includes("prices")) s += priceHeuristic(x.title);

    return { x, s };
  });

  scored.sort((a, b) => b.s - a.s);
  return scored.map((r) => r.x);
}

export function freeRerankWithScores(
  items: RankItem[],
  profile: Profile
): { id: string; score: number }[] {
  const ranked = freeRerank(items, profile);
  const N = ranked.length;
  return ranked.map((r, idx) => ({ id: r.id, score: N - idx }));
}
