import mongoose from "mongoose";

const coachProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    profilePhoto: {
      type: String,
      default: null,
    },

    coachType: {
      type: String,
      enum: ["batting", "bowling", "fitness", "fielding", "all-round"],
    },

    experienceYears: Number,

    aboutMe: String,

    specialties: {
      type: [String],
      default: [],
    },

    rating: {
      type: Number,
      default: 0,
      immutable: true,
    },

    playersCount: {
      type: Number,
      default: 0,
      immutable: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
      immutable: true,
    },

    plan: {
      type: String,
      enum: ["free", "pro", "elite"],
      default: "free",
    },

    profileCompletion: {
      type: Number,
      default: 20,
    },
  },
  { timestamps: true }
);

// Indexes for discovery
coachProfileSchema.index({ coachType: 1 });
coachProfileSchema.index({ specialties: 1 });
coachProfileSchema.index({ rating: -1 });
coachProfileSchema.index({ isVerified: 1 });

export default mongoose.model("CoachProfile", coachProfileSchema);
