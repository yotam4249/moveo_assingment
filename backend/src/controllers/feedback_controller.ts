// src/controllers/feedback_controller.ts
import { Request, Response } from "express";
import userModel from "../models/users_model";

type AuthedRequest = Request & { params: { userId: string } };

function ensureMap(obj: any) {
  // אם זה כבר Map – תחזיר כמו שהוא; אם אובייקט – המר ל-Map
  if (obj && typeof obj.get === "function" && typeof obj.set === "function") return obj;
  const m = new Map<string, number>();
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) m.set(k, Number(v));
  }
  return m;
}

export async function submitFeedback(req: AuthedRequest, res: Response) {
  try {
    const { itemId, decision, assets, tags } = req.body as {
      itemId?: string;
      decision?: "up" | "down";
      assets?: string[];
      tags?: string[];
    };

    if (!itemId || !decision) {
      return res.status(400).json({ message: "itemId and decision are required" });
    }

    const user = await userModel.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const delta = decision === "up" ? 1 : -1;

    // ודא מבנים
    if (!user.recommendationProfile) (user as any).recommendationProfile = {};
    (user as any).recommendationProfile.assetScores = ensureMap(user.recommendationProfile.assetScores);
    (user as any).recommendationProfile.contentScores = ensureMap(user.recommendationProfile.contentScores);

    // עדכון ניקודים
    (assets ?? []).forEach((a) => {
      const m = user.recommendationProfile.assetScores as any;
      const cur = m.get(a) ?? 0;
      m.set(a, cur + delta);
    });

    (tags ?? []).forEach((t) => {
      const m = user.recommendationProfile.contentScores as any;
      const cur = m.get(t) ?? 0;
      m.set(t, cur + delta);
    });

    user.recommendationProfile.updatedAt = new Date();
    user.markModified("recommendationProfile");

    await user.save();
    res.json({ message: "Feedback saved" });
  } catch (e) {
    console.error("submitFeedback error", e);
    res.status(500).json({ message: "Server error" });
  }
}
