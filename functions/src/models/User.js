import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: false, // Optional because Firebase users won't have it
      select: false,   // Don't return by default
    },
    role: {
      type: String,
      enum: ["guardian", "player", "coach"],
      required: true,
    },
    signInProviders: {
      type: [String],
      enum: ["password", "google.com", "apple.com"],
      default: [],
    },
    // refresh token store in db for more security
    refreshToken: {
      type: String,
      default: null,
    },
    // For dark mode, notifications, language – from Settings screen
    preferences: {
      pushNotifications: { type: Boolean, default: true },
      darkMode: { type: Boolean, default: false },
      language: {
        type: String,
        default: "en-US",
      },
    },
    // FCM device tokens for push notifications (one per device, max 5)
    fcmTokens: {
      type: [String],
      default: [],
    },
    // Very useful for knowing when profile was meaningfully updated
    lastProfileUpdate: {
      type: Date,
    },
    // Profile references (optional, profiles are stored separately)
    coachProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CoachProfile',
    },
    playerProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlayerProfile',
    },
    guardianProfile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GuardianProfile',
    },
    // Set to true after welcome email is sent (on first verified login)
    welcomeEmailSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Helpful compound index if you query by role + name/email frequently
userSchema.index({ role: 1, fullName: "text", email: 1 });

export default mongoose.model("User", userSchema);