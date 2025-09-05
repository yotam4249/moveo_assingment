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

/** GET /feed — ranked content; no meme here (UI calls /meme separately) */
export async function getFeed(req: AuthedRequest, res: Response) {
  try {
    const uid = resolveUserId(req);
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const { items, ranked } = await getCuratedFeed(uid);
    return res.json({
      date: new Date().toISOString(),
      items,
      ranked,
      meme: null, // UI fetches via /meme
    });
  } catch (e: any) {
    console.error("[feed] fatal:", e?.message || e);
    return res.status(500).json({
      date: new Date().toISOString(),
      items: [],
      ranked: { news: [], prices: [], insight: [] },
      meme: null,
      error: "Failed to build feed",
    });
  }
}

/** GET /meme — returns a Reddit image; avoids ?avoid when possible */
export async function getMeme(req: Request, res: Response) {
  try {
    const avoid = (req.query?.avoid as string) || "";
    const meme = await getRandomMeme(avoid);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    console.log("[/meme] avoid =", avoid, "chosen =", meme?.url);
    return res.json(meme); // { url:"", caption:"" } if Reddit yields nothing
  } catch (e: any) {
    console.error("[/meme] error:", e?.message || e);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({ url: "", caption: "" });
  }
}
