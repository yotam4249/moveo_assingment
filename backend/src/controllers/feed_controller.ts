// src/controllers/feed_controller.ts
import { Request, Response } from "express";
import { getCuratedContent } from "../services/content_service";
import { getRandomMeme } from "../services/vendor/reddit_memes";

type AuthedRequest = Request & { params: { userId: string } };

export async function getFeed(req: AuthedRequest, res: Response) {
  try {
    const [items, meme] = await Promise.all([
      getCuratedContent(req.params.userId),
      getRandomMeme(),
    ]);
    res.json({ date: new Date().toISOString(), items, meme });
  } catch (e) {
    console.error("getFeed error", e);
    res.status(500).json({ message: "Server error" });
  }
}

export async function getMeme(_req: AuthedRequest, res: Response) {
  try {
    const meme = await getRandomMeme();
    res.json(meme);
  } catch {
    res.json({ url: "https://i.imgflip.com/30b1gx.jpg", caption: "HODL even the coffee ☕🚀" });
  }
}
