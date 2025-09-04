// src/services/vendor/free_rerank.ts

import { ContentTag } from "../content_service";

export type RankItem = {
    id: string;
    title: string;
    summary: string;
    tags: ContentTag[];        // ["news" | "prices" | "insight"]
    assets: string[];      // ["BTC","ETH"...]
    url?: string;
    publishedAt?: Date;
    source?: string;
  };
  
  export type Profile = {
    assets: string[];
    contentPrefs: string[];
    investorType?: string; // לא בשימוש כבד כאן, אפשר להרחיב
    assetScores: Record<string, number>;
    contentScores: Record<string, number>;
  };
  
  function freshnessBoost(d?: Date) {
    if (!d) return 0;
    const hours = (Date.now() - d.getTime()) / 36e5;
    if (hours <= 6) return 2;
    if (hours <= 24) return 1.2;
    if (hours <= 48) return 0.7;
    return 0.2;
  }
  
  function priceHeuristic(title: string) {
    // בוסט לכותרות מחירים “חמות”
    if (/(\+|\-)\d+(\.\d+)?%/.test(title)) return 1.0;
    if (/break(out|down)|rally|dump|spike/i.test(title)) return 0.8;
    return 0.3;
  }
  
  export function freeRerank(items: RankItem[], profile: Profile): RankItem[] {
    const { assets, contentPrefs, assetScores, contentScores } = profile;
  
    const scored = items.map((x) => {
      let s = 0;
  
      // חפיפת תגיות (news/prices/insight)
      const tagMatches = x.tags.filter((t) => contentPrefs.includes(t)).length;
      s += tagMatches * 2;
  
      // חפיפת נכסים
      const assetOverlap = x.assets.filter((a) => assets.includes(a)).length;
      s += assetOverlap * 2;
  
      // היסטוריית feedback
      for (const a of x.assets) s += (assetScores[a] ?? 0) * 0.5;
      for (const t of x.tags) s += (contentScores[t] ?? 0) * 0.5;
  
      // טריות ידיעה
      s += freshnessBoost(x.publishedAt);
  
      // היגיון למחירים
      if (x.tags.includes("prices")) s += priceHeuristic(x.title);
  
      return { x, s };
    });
  
    scored.sort((a, b) => b.s - a.s);
    return scored.map((r) => r.x);
  }
  