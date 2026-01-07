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
    plan: {
      type: String,
      default: "free",
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
