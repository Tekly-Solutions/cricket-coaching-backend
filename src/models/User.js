import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
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
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
