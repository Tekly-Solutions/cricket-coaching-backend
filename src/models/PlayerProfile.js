import mongoose from "mongoose";

const playerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,          // ← optional for minors
      unique: true,
      sparse: true,
    },

    // For minors (no User yet) → store name here
    // For self-managed → will be null or auto-filled from User
    fullName: {
      type: String,
      trim: true,
      required: function () {
        // Required only if no userId (i.e. minor without account)
        return !this.userId;
      },
    },

    // For players under 16 → guardian is required (enforced in business logic)
    guardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        // Required for minors (when no userId)
        return !this.userId;
      },
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
      // required: true,
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
      // required: true,
    },

    // Medical conditions or issues (e.g., "Asthma", "None", etc.)
    medicalIssues: {
      type: String,
      trim: true,
      default: "",
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

// Virtual: always return the correct fullName
playerProfileSchema.virtual('displayName').get(function () {
  if (this.userId && this.populate('userId')) {
    return this.userId.fullName; // from User if exists
  }
  return this.fullName; // from profile if minor
});

// Ensure virtuals are included when converting to JSON
playerProfileSchema.set('toJSON', { virtuals: true });
playerProfileSchema.set('toObject', { virtuals: true });

export default mongoose.model("PlayerProfile", playerProfileSchema);