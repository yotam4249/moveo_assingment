// // src/controllers/feedback_controller.ts
// import { Request, Response } from "express";
// import userModel from "../models/users_model";
// import { getCuratedFeed } from "../services/content_service";

// type FeedbackBody = {
//   itemId: string;
//   decision: "up" | "down";
//   assets?: string[];
//   tags?: string[];
// };

// type AuthedReq = Request & {
//   user?: { id?: string; sub?: string } | any;
//   userId?: string;
//   body: FeedbackBody;
//   params: { userId?: string };
// };

// const toSym = (s: string) => (s || "").trim().toUpperCase();
// const AI_V2_PREFIX = "insight:ai:v2:";

// function ensureNumberMap(m: unknown): Map<string, number> {
//   if (m instanceof Map) return m;
//   const out = new Map<string, number>();
//   if (m && typeof m === "object") {
//     for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
//       out.set(String(k), Number(v));
//     }
//   }
//   return out;
// }

// function resolveUserId(req: AuthedReq): string | undefined {
//   return (
//     req.user?.id ||
//     req.userId ||
//     (req.user && (req.user.sub as string)) ||
//     (req as any).auth?.userId ||
//     req.params?.userId
//   );
// }

// function normalizeKey(k: string): string {
//   return String(k).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
// }

// export async function submitFeedback(req: AuthedReq, res: Response) {
//   const ts = new Date().toISOString();
//   try {
//     const userId = resolveUserId(req);
//     if (!userId) {
//       console.warn(`[feedback ${ts}] 401 missing user`);
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     const { itemId, decision } = (req.body || {}) as FeedbackBody;
//     const assetsRaw = ((req.body || {}).assets ?? []) as unknown[];
//     const tagsRaw = ((req.body || {}).tags ?? []) as unknown[];

//     if (!itemId || (decision !== "up" && decision !== "down")) {
//       console.warn(`[feedback ${ts}] 400 invalid payload`, req.body);
//       return res.status(400).json({ error: "Invalid payload" });
//     }

//     const uniqAssets: string[] = Array.from(
//       new Set(assetsRaw.map((a) => toSym(String(a))).filter(Boolean))
//     );
//     const uniqTags: string[] = Array.from(
//       new Set(tagsRaw.map((t) => String(t)).filter(Boolean))
//     );

//     console.log(
//       `[feedback ${ts}] user=${userId} decision=${decision} itemId=${itemId} assets=[${uniqAssets.join(
//         ","
//       )}] tags=[${uniqTags.join(",")}]`
//     );

//     const user = await userModel.findById(userId);
//     if (!user) {
//       console.warn(`[feedback ${ts}] 404 user not found: ${userId}`);
//       return res.status(404).json({ error: "User not found" });
//     }

//     const rp: any = (user as any).recommendationProfile || {};
//     const assetMap = ensureNumberMap(rp.assetScores);
//     const contentMap = ensureNumberMap(rp.contentScores);

//     const delta = decision === "down" ? -1 : +1;

//     // --- update assets as before ---
//     for (const a of uniqAssets) {
//       const cur = assetMap.get(a) ?? 100;
//       const nxt = Math.max(0, cur + delta);
//       assetMap.set(a, nxt);
//       console.log(`[feedback ${ts}] assetScore[${a}] ${cur} -> ${nxt}`);
//     }

//     // --- update content scores ---
//     let targetContentKey: string | null = null;

//     // AI v2 card: extract slug from id
//     if (itemId.startsWith(AI_V2_PREFIX)) {
//       const parts = itemId.split(":"); // ['insight','ai','v2','<slug>','<hash>']
//       const slug = parts[3];
//       const found = Array.from(contentMap.keys()).find(
//         (k) => normalizeKey(k) === slug
//       );
//       if (found) targetContentKey = found;
//     }

//     if (targetContentKey) {
//       const cur = contentMap.get(targetContentKey) ?? 100;
//       const nxt = Math.max(0, cur + delta);
//       contentMap.set(targetContentKey, nxt);
//       console.log(
//         `[feedback ${ts}] contentScore[${targetContentKey}] ${cur} -> ${nxt} (from AI v2 id ${itemId})`
//       );
//     } else {
//       // fallback (old behavior): use tags for news/prices/insight
//       const sectionIsAssetOnly =
//         uniqTags.includes("news") || uniqTags.includes("prices");
//       if (!sectionIsAssetOnly) {
//         for (const t of uniqTags) {
//           const cur = contentMap.get(t) ?? 100;
//           const nxt = Math.max(0, cur + delta);
//           contentMap.set(t, nxt);
//           console.log(`[feedback ${ts}] contentScore[${t}] ${cur} -> ${nxt}`);
//         }
//       }
//     }

//     rp.assetScores = assetMap;
//     rp.contentScores = contentMap;
//     rp.updatedAt = new Date();
//     (user as any).recommendationProfile = rp;

//     user.markModified("recommendationProfile.assetScores");
//     user.markModified("recommendationProfile.contentScores");
//     user.markModified("recommendationProfile");

//     await user.save();
//     console.log(`[feedback ${ts}] profile saved for user=${userId}`);

//     const fresh = await getCuratedFeed(userId);
//     return res.json({ ok: true, feed: fresh });
//   } catch (err: any) {
//     console.error(`[feedback ${ts}] fatal:`, err?.message || err);
//     return res.status(500).json({ error: "Failed to record feedback" });
//   }
// }
// src/controllers/feedback_controller.ts
import { Request, Response } from "express";
import userModel from "../models/users_model";
import { getCuratedFeed } from "../services/content_service";

type FeedbackBody = {
  itemId: string;
  decision: "up" | "down";
  assets?: string[];
  tags?: string[];
};

type AuthedReq = Request & {
  user?: { id?: string; sub?: string } | any;
  userId?: string;
  body: FeedbackBody;
  params: { userId?: string };
};

const toSym = (s: string) => (s || "").trim().toUpperCase();
const AI_V2_PREFIX = "insight:ai:v2:";

function ensureNumberMap(m: unknown): Map<string, number> {
  if (m instanceof Map) return m;
  const out = new Map<string, number>();
  if (m && typeof m === "object") {
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      out.set(String(k), Number(v));
    }
  }
  return out;
}

function resolveUserId(req: AuthedReq): string | undefined {
  return (
    req.user?.id ||
    req.userId ||
    (req.user && (req.user.sub as string)) ||
    (req as any).auth?.userId ||
    req.params?.userId
  );
}

function normalizeKey(k: string): string {
  return String(k).trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export async function submitFeedback(req: AuthedReq, res: Response) {
  const ts = new Date().toISOString();
  try {
    const userId = resolveUserId(req);
    if (!userId) {
      console.warn(`[feedback ${ts}] 401 missing user`);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { itemId, decision } = (req.body || {}) as FeedbackBody;
    const assetsRaw = ((req.body || {}).assets ?? []) as unknown[];
    const tagsRaw = ((req.body || {}).tags ?? []) as unknown[];

    if (!itemId || (decision !== "up" && decision !== "down")) {
      console.warn(`[feedback ${ts}] 400 invalid payload`, req.body);
      return res.status(400).json({ error: "Invalid payload" });
    }

    const uniqAssets: string[] = Array.from(
      new Set(assetsRaw.map((a) => toSym(String(a))).filter(Boolean))
    );
    const uniqTags: string[] = Array.from(
      new Set(tagsRaw.map((t) => String(t)).filter(Boolean))
    );

    console.log(
      `[feedback ${ts}] user=${userId} decision=${decision} itemId=${itemId} assets=[${uniqAssets.join(
        ","
      )}] tags=[${uniqTags.join(",")}]`
    );

    const user = await userModel.findById(userId);
    if (!user) {
      console.warn(`[feedback ${ts}] 404 user not found: ${userId}`);
      return res.status(404).json({ error: "User not found" });
    }

    const rp: any = (user as any).recommendationProfile || {};
    const assetMap = ensureNumberMap(rp.assetScores);
    const contentMap = ensureNumberMap(rp.contentScores);

    // Base deltas
    const assetDelta = decision === "down" ? -1 : +1;

    // Default content delta is light, but AI v2 should be stronger so the topKey can change
    let contentDelta = decision === "down" ? -1 : +1;

    // --- update assets as before ---
    for (const a of uniqAssets) {
      const cur = assetMap.get(a) ?? 100;
      const nxt = Math.max(0, cur + assetDelta);
      assetMap.set(a, nxt);
      console.log(`[feedback ${ts}] assetScore[${a}] ${cur} -> ${nxt}`);
    }

    // --- update content scores ---
    let targetContentKey: string | null = null;

    // AI v2 card: extract slug from id
    if (itemId.startsWith(AI_V2_PREFIX)) {
      const parts = itemId.split(":"); // ['insight','ai','v2','<slug>','<hash>']
      const slug = parts[3];
      const found = Array.from(contentMap.keys()).find(
        (k) => normalizeKey(k) === slug
      );
      if (found) {
        targetContentKey = found;
        // make AI insight votes “heavier”
        contentDelta = decision === "down" ? -5 : +3;
      }
    }

    if (targetContentKey) {
      const cur = contentMap.get(targetContentKey) ?? 100;
      const nxt = Math.max(0, cur + contentDelta);
      contentMap.set(targetContentKey, nxt);
      console.log(
        `[feedback ${ts}] contentScore[${targetContentKey}] ${cur} -> ${nxt} (delta ${contentDelta})`
      );
    } else {
      // fallback (old behavior): use tags for news/prices/insight, but avoid “insight” tag global hits
      const sectionIsAssetOnly =
        uniqTags.includes("news") || uniqTags.includes("prices");
      if (!sectionIsAssetOnly) {
        for (const t of uniqTags) {
          // skip global "insight" tag nudges; AI v2 handled above
          if (t === "insight") continue;
          const cur = contentMap.get(t) ?? 100;
          const nxt = Math.max(0, cur + contentDelta);
          contentMap.set(t, nxt);
          console.log(`[feedback ${ts}] contentScore[${t}] ${cur} -> ${nxt}`);
        }
      }
    }

    rp.assetScores = assetMap;
    rp.contentScores = contentMap;
    rp.updatedAt = new Date();
    (user as any).recommendationProfile = rp;

    user.markModified("recommendationProfile.assetScores");
    user.markModified("recommendationProfile.contentScores");
    user.markModified("recommendationProfile");

    await user.save();
    console.log(`[feedback ${ts}] profile saved for user=${userId}`);

    const fresh = await getCuratedFeed(userId);
    return res.json({ ok: true, feed: fresh });
  } catch (err: any) {
    console.error(`[feedback ${ts}] fatal:`, err?.message || err);
    return res.status(500).json({ error: "Failed to record feedback" });
  }
}
