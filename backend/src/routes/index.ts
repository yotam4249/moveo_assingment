import { Router } from "express";
import authRoutes from "./auth_routes";
import onboardingRoutes from "./onboarding_routes";
import feedRoutes from "./feed_routes";

const api = Router();


api.use("/auth", authRoutes);
api.use("/onboarding", onboardingRoutes);
api.use("/", feedRoutes);

export default api;
