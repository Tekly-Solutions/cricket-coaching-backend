import mongoose from "mongoose";

const playerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // For players under 16 → guardian is required (enforced in business logic)
    guardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // not required in schema → we enforce it via validation / pre-save hook
    },

    // Avatar shown in home screen, coach view, etc.
    profilePhoto: {
      type: String,
      default: null,
    },

    // "Batsman", "All-rounder", "Bowler", ...
    role: {
      type: String,
      required: true,
    },

    // "Right-hand bat", "Left-hand bat", ...
    battingStyle: {
      type: String,
      required: true,
    },

    // "Right-arm fast", "Left-arm orthodox", "" (empty if not applicable)
    bowlingStyle: {
      type: String,
      default: "",
    },

    // Stored as string to match your current Dart mock data exactly
    // Examples: "14", "15", "17", "18", ...
    age: {
      type: String,
      trim: true,
      required: true,
    },

    // Optional – can be calculated or set manually
    // Helps quickly identify who needs guardian oversight
    isSelfManaged: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("PlayerProfile", playerProfileSchema);