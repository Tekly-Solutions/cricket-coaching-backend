import mongoose from "mongoose";

const playerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    guardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    age: Number,
    level: String,
    sport: String,
  },
  { timestamps: true }
);

export default mongoose.model("PlayerProfile", playerProfileSchema);
