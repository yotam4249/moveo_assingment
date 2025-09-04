import { Request, Response } from "express";
import userModel from "../models/users_model";

// authMiddleware attaches userId to req.params.userId
type AuthedRequest = Request & { params: { userId: string } };

export async function getStatus(req: AuthedRequest, res: Response) {
  try {
    const user = await userModel.findById(req.params.userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const onboarding =
      user.onboarding || { completed: false, assets: [], investorType: "", contentPrefs: [] };

    res.json({
      completed: !!onboarding.completed,
      onboarding,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}

export async function submit(req: AuthedRequest, res: Response) {
  try {
    const { assets, investorType, contentPrefs } = req.body as {
      assets?: string[];
      investorType?: string;
      contentPrefs?: string[];
    };

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ message: "assets (string[]) is required" });
    }
    if (!investorType || typeof investorType !== "string" || investorType.trim().length === 0) {
      return res.status(400).json({ message: "investorType (string) is required" });
    }
    if (!contentPrefs || !Array.isArray(contentPrefs) || contentPrefs.length === 0) {
      return res.status(400).json({ message: "contentPrefs (string[]) is required" });
    }

    const user = await userModel.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.onboarding = {
      completed: true,
      assets: assets.map(String),
      investorType: String(investorType),
      contentPrefs: contentPrefs.map(String),
      completedAt: new Date(),
    };

    await user.save();

    res.status(200).json({
      message: "Onboarding saved",
      onboarding: user.onboarding,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
}
