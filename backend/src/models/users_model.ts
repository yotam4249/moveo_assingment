import mongoose, { Schema, Document, Model } from "mongoose";
import { onboardingSchema, IOnboarding, recommendationProfileSchema, IRecommendationProfile } from "./schemas";

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  refreshTokens?: string[];

  onboarding?: IOnboarding;
  recommendationProfile: IRecommendationProfile;

  id: string;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, trim: true, unique: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    password: { type: String, required: true },
    refreshTokens: { type: [String], default: [] },

    onboarding: { type: onboardingSchema, default: {} },
    recommendationProfile: { type: recommendationProfileSchema, default: {} },
  },
  { timestamps: true }
);


userSchema.set("toJSON", {
  versionKey: false,
  transform(_doc, ret) {
    ret._id = ret._id?.toString?.();
    delete ret.password;
    delete ret.refreshTokens;
    return ret;
  },
});

const userModel: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default userModel;
