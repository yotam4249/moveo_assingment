import { Router } from "express";
import { authMiddleware } from "../controllers/auth_controller";
import { getStatus, submit } from "../controllers/onboarding_controller";

const router = Router();

router.get("/status", authMiddleware, getStatus);
router.post("/", authMiddleware, submit);

export default router;
