import { Schema } from "mongoose";
import type { InvestorType } from "../types";

export interface IOnboarding {
  completed: boolean;
  assets: string[];
  investorType?: InvestorType;
  contentPrefs: string[];
  completedAt?: Date;
}

export const onboardingSchema = new Schema<IOnboarding>(
  {
    completed: { type: Boolean, default: false },
    assets: { type: [String], default: [] },
    investorType: { type: String, default: "" }, // מחרוזת פתוחה
    contentPrefs: { type: [String], default: [] },
    completedAt: { type: Date, default: undefined },
  },
  { _id: false }
);
