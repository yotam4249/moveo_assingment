// src/controllers/feed_controller.ts
import { Request, Response } from "express";
import { getCuratedFeed } from "../services/content_service";
import { getRandomMeme } from "../services/vendor/reddit_memes";

type AuthedRequest = Request & {
  user?: { id?: string; sub?: string } | any;
  userId?: string;
  params: { userId?: string };
};

function resolveUserId(req: AuthedRequest): string | undefined {
  return (
    req.user?.id ||
    req.userId ||
    (req.user && (req.user.sub as string)) ||
    (req as any).auth?.userId ||
    req.params?.userId
  );
}

/**
 * GET /feed
 * Returns:
 *  - date: ISO timestamp
 *  - items: mixed top ~8 (backward compatible)
 *  - ranked: { news, prices, insight } each sorted high→low by score
 *  - meme: random meme with safe fallback
 */
export async function getFeed(req: AuthedRequest, res: Response) {
  try {
    const uid = resolveUserId(req);
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [feedRes, memeRes] = await Promise.allSettled([
      getCuratedFeed(uid),
      getRandomMeme(),
    ]);

    const { items, ranked } =
      feedRes.status === "fulfilled"
        ? feedRes.value
        : { items: [], ranked: { news: [], prices: [], insight: [] } };

    const meme =
      memeRes.status === "fulfilled"
        ? memeRes.value
        : {
            url: "https://i.imgflip.com/30b1gx.jpg",
            caption: "HODL even the coffee ☕🚀",
          };

    res.json({
      date: new Date().toISOString(),
      items,   // legacy mixed list
      ranked,  // NEW per-section arrays (sorted by score desc)
      meme,    // keep for UI compatibility
    });
  } catch (e: any) {
    console.error("[feed] fatal:", e?.message || e);
    res.status(500).json({
      date: new Date().toISOString(),
      items: [],
      ranked: { news: [], prices: [], insight: [] },
      meme: {
        url: "https://i.imgflip.com/30b1gx.jpg",
        caption: "HODL even the coffee ☕🚀",
      },
      error: "Failed to build feed",
    });
  }
}

/**
 * GET /meme
 * Separate endpoint; preserves your existing behavior with a safe fallback.
 */
// inside src/controllers/feed_controller.ts


export async function getMeme(req: Request, res: Response) {
  try {
    const avoid = (req.query?.avoid as string) || "";
    const meme = await getRandomMeme(avoid);
    // prevent proxies from serving stale results
    res.setHeader("Cache-Control", "no-store, max-age=0");
    console.log("[/meme] avoid =", avoid, "chosen =", meme?.url);
    return res.json(meme);
  } catch (e: any) {
    console.error("[/meme] error:", e?.message || e);
    return res.status(200).json({ url: "", caption: "No meme available" });
  }
}

