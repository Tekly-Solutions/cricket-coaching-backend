import mongoose from "mongoose";

const guardianProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    phoneNumber: String,
    address: String,
  },
  { timestamps: true }
);

export default mongoose.model("GuardianProfile", guardianProfileSchema);
