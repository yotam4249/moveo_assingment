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

/** Get current user's onboarding status (requires auth) */
export async function getStatus(): Promise<OnboardingStatus> {
  const { data } = await apiClient.get<OnboardingStatus>("/onboarding");
  return data;
}

/** Submit onboarding answers (requires auth) */
export async function submitOnboarding(payload: OnboardingPayload) {
  const { data } = await apiClient.post("/onboarding", payload);
  return data;
}

const onboardingService = { getStatus, submitOnboarding };
export default onboardingService;
