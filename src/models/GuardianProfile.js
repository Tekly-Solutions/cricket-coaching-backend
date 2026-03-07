import mongoose from "mongoose";

const guardianProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    phoneNumber: {
      type: String,
      trim: true,
    },

    profilePhoto: {
      type: String,
      default: null,
    },

    address: {
      type: String,
      trim: true,
    },

    // NEW: array of PlayerProfile IDs (not User IDs)
    players: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlayerProfile",
    }],

    // Optional: if you want to track when guardian was linked
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("GuardianProfile", guardianProfileSchema);