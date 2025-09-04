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
}

export interface Meme {
  url: string;
  caption: string;
}

export interface FeedResponse {
  date: string;          // ISO
  items: ContentItem[];  // curated by server
  meme: Meme;            // random meme from server
}

/** GET the curated feed from your server (auth required) */
export async function fetchFeed(): Promise<FeedResponse> {
  const { data } = await apiClient.get<FeedResponse>("/feed");
  return data;
}

/** POST user feedback (auth required) */
export async function submitFeedback(
  item: Pick<ContentItem, "id" | "tags" | "assets">,
  decision: "up" | "down"
): Promise<void> {
  await apiClient.post("/feedback", {
    itemId: item.id,
    decision,
    assets: item.assets,
    tags: item.tags,
  });
}

const dashboardService = { fetchFeed, submitFeedback };
export default dashboardService;
