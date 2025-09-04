// src/controllers/onboarding_controller.ts
import { Request, Response } from "express";
import userModel from "../models/users_model";

// authMiddleware attaches userId to req.params.userId
type AuthedRequest = Request & { params: { userId: string } };

const toSym = (s: string) => String(s || "").trim().toUpperCase();
const tidy = (s: string) => String(s || "").trim();

/** Ensure we have a real Map<string, number>. If an object slipped in before, convert it. */
function ensureNumberMap(m: any): Map<string, number> {
  if (m instanceof Map) return m as Map<string, number>;
  const out = new Map<string, number>();
  if (m && typeof m === "object") {
    for (const [k, v] of Object.entries(m)) out.set(String(k), Number(v));
  }
  return out;
}

export async function getStatus(req: AuthedRequest, res: Response) {
  try {
    const user = await userModel.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const onboarding =
      user.onboarding || { completed: false, assets: [], investorType: "", contentPrefs: [] };

    res.json({
      completed: !!onboarding.completed,
      onboarding,
      // expose profile as-is (may show plain objects if queried via .lean())
      recommendationProfile: user.recommendationProfile ?? { assetScores: {}, contentScores: {} },
    });
  } catch (err) {
    console.error("onboarding.getStatus error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

export async function submit(req: AuthedRequest, res: Response) {
  try {
    const body = req.body as {
      assets?: string[];
      investorType?: string;
      contentPrefs?: string[];
    };

    // Validate basics
    if (!Array.isArray(body.assets) || body.assets.length === 0) {
      return res.status(400).json({ message: "assets (string[]) is required" });
    }
    if (!body.investorType || typeof body.investorType !== "string" || !body.investorType.trim()) {
      return res.status(400).json({ message: "investorType (string) is required" });
    }
    if (!Array.isArray(body.contentPrefs) || body.contentPrefs.length === 0) {
      return res.status(400).json({ message: "contentPrefs (string[]) is required" });
    }

    // Normalize + dedupe
    const assets = Array.from(new Set(body.assets.map(toSym).filter(Boolean)));
    const investorType = tidy(body.investorType);
    const contentPrefs = Array.from(new Set(body.contentPrefs.map(tidy).filter(Boolean)));

    const user = await userModel.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // 1) Save onboarding
    user.onboarding = {
      completed: true,
      assets,
      investorType,
      contentPrefs,
      completedAt: new Date(),
    };

    // 2) Seed recommendationProfile maps with baseline 100 (preserve existing values if any)
    const rp: any = (user as any).recommendationProfile || {};
    const assetMap = ensureNumberMap(rp.assetScores);
    const contentMap = ensureNumberMap(rp.contentScores);

    for (const a of assets) {
      if (!assetMap.has(a)) assetMap.set(a, 100);
    }
    for (const p of contentPrefs) {
      if (!contentMap.has(p)) contentMap.set(p, 100);
    }

    rp.assetScores = assetMap;
    rp.contentScores = contentMap;
    rp.updatedAt = new Date();
    (user as any).recommendationProfile = rp;

    // Mark nested maps as modified so Mongoose persists them
    user.markModified("recommendationProfile.assetScores");
    user.markModified("recommendationProfile.contentScores");
    user.markModified("recommendationProfile");

    await user.save();

    return res.status(200).json({
      message: "Onboarding saved",
      onboarding: user.onboarding,
      recommendationProfile: user.recommendationProfile,
    });
  } catch (err) {
    console.error("onboarding.submit error:", err);
    res.status(500).json({ message: "Server error" });
  }
}
