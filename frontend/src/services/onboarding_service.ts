// src/services/onboarding_service.ts
import apiClient from "./api";

export interface OnboardingPayload {
  assets: string[];
  investorType: string;
  contentPrefs: string[];
}

export interface OnboardingStatus {
  completed: boolean;
  onboarding: {
    completed: boolean;
    assets: string[];
    investorType: string;
    contentPrefs: string[];
    completedAt?: string;
  };
}

/** ✅ Server route is GET /api/onboarding/status */
export async function getStatus(): Promise<OnboardingStatus> {
  const { data } = await apiClient.get<OnboardingStatus>("/onboarding/status");
  return data;
}

/** ✅ Server route is POST /api/onboarding */
export async function submitOnboarding(payload: OnboardingPayload) {
  const { data } = await apiClient.post("/onboarding", payload);
  return data;
}

const onboardingService = { getStatus, submitOnboarding };
export default onboardingService;
