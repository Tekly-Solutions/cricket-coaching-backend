import mongoose from "mongoose";

const coachProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    profilePhoto: String,
    coachType: String, // batting, bowling, fitness
    experienceYears: Number,
    aboutMe: String,

    specialties: [String],

    rating: { type: Number, default: 0 },
    playersCount: { type: Number, default: 0 },

    isVerified: { type: Boolean, default: false },
    plan: {
      type: String,
      default: "free",
    },
  },
  { timestamps: true }
);

export default mongoose.model("CoachProfile", coachProfileSchema);
