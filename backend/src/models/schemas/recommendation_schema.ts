import { Schema } from "mongoose";

export interface IRecommendationProfile {
  assetScores: Map<string, number>;
  contentScores: Map<string, number>;
  updatedAt?: Date;
}

export const recommendationProfileSchema = new Schema<IRecommendationProfile>(
  {
    assetScores: { type: Map, of: Number, default: {} },
    contentScores: { type: Map, of: Number, default: {} },
    updatedAt: { type: Date, default: undefined },
  },
  { _id: false }
);
