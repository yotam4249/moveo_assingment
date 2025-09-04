// src/routes/feed_routes.ts
import { Router } from "express";
import { authMiddleware } from "../controllers/auth_controller";
import { getFeed, getMeme } from "../controllers/feed_controller";
import { submitFeedback } from "../controllers/feedback_controller";

const router = Router();

router.get("/feed", authMiddleware, getFeed);
router.get("/meme", authMiddleware, getMeme);
router.post("/feedback", authMiddleware, submitFeedback);

export default router;
