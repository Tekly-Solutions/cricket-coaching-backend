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
      default: null,           // Cloudinary / S3 URL
    },

    // Shown in coach profile card → "Head Coach • Pro Plan"
    coachTitle: {
      type: String,
      trim: true,
      // examples: "Head Coach", "Batting Coach", "Strength & Conditioning Coach"
    },

    // More flexible than single enum — allows multiple (as seen in many coach profiles)
    specialties: {
      type: [String],
      default: [],
      // Examples: "Batting", "Fast Bowling", "Spin Bowling", "Fitness", " Fielding", "Mental Conditioning"
    },

    // Was coachType — renamed + made enum more realistic
    primarySpecialization: {
      type: String,
      enum: [
        "batting",
        "bowling",
        "fitness",
        "fielding",
        "all-round",
        "wicketkeeping",
        "mental",
        "other"
      ],
      default: null,
    },

    certifications: {
      type: [String],
      default: [],
      // e.g. ["USPTR PRO", "ECB Level 3", "Strength & Conditioning Cert", "ICC Level 2"]
    },

    experienceYears: {
      type: Number,
      min: 0,
      default: 0,
    },

    aboutMe: {
      type: String,
      maxlength: 1200,
      trim: true,
      // bio shown in Edit Profile & possibly public coach profile
    },

    // From ProUpgradeScreen / subscription badge
    plan: {
      type: String,
      enum: ["free", "pro", "elite"],
      default: "free",
    },

    // Optional — if you later show subscription expiry or status
    subscription: {
      status: {
        type: String,
        enum: ["active", "inactive", "cancelled", "trial", "expired"],
        default: "inactive",
      },
      expiresAt: { type: Date },
    },

    // Stats displayed / calculated (can be updated via backend jobs or triggers)
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    playersCoachedCount: {
      type: Number,
      default: 0,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    // Helps show completion % in UI or restrict features
    profileCompletionPercentage: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },

    // Optional — if coaches set availability (future feature)
    availability: {
      type: [String],
      default: [], // e.g. ["Mon-Fri 16:00-20:00", "Sat 09:00-13:00"]
    },
  },
  { timestamps: true }
);

// Useful indexes (depending on your search/discovery features)
coachProfileSchema.index({ primarySpecialization: 1 });
coachProfileSchema.index({ specialties: 1 });
coachProfileSchema.index({ rating: -1 });
coachProfileSchema.index({ isVerified: 1, plan: 1 });
coachProfileSchema.index({ playersCoachedCount: -1 });

export default mongoose.model("CoachProfile", coachProfileSchema);