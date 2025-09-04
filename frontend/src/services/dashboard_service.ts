// src/services/dashboard_service.ts
import apiClient from "./api";

export type ContentTag = "news" | "prices" | "insight";

export interface ContentItem {
  id: string;
  title: string;
  summary: string;
  url?: string;
  tags: ContentTag[];
  assets: string[];
  publishedAt?: string | Date;
  source?: string;
  score?: number; // backend adds this
}

export interface Meme { url: string; caption: string; }

export interface RankedFeed {
  news: ContentItem[];
  prices: ContentItem[];
  insight: ContentItem[];
}

export interface FeedResponse {
  date: string;
  items: ContentItem[];
  ranked?: RankedFeed;
  meme: Meme | null;
}

/** GET the curated feed (auth required) */
export async function fetchFeed(): Promise<FeedResponse> {
  const { data } = await apiClient.get<FeedResponse>("/feed");
  return data;
}

/** POST feedback and get a fresh feed back (auth required) */
export async function submitFeedback(
  item: Pick<ContentItem, "id" | "tags" | "assets">,
  decision: "up" | "down"
): Promise<{ ok: true; feed?: FeedResponse }> {
  const { data } = await apiClient.post("/feedback", {
    itemId: item.id,
    decision,
    assets: item.assets,
    tags: item.tags,
  });
  return data; // <-- backend returns { ok: true, feed }
}

const dashboardService = { fetchFeed, submitFeedback };
export default dashboardService;
