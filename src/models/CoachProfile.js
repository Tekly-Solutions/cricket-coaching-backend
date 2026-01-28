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

    // Availability Management
    availability: {
      // Recurring weekly schedule
      recurringSchedule: {
        activeDays: {
          type: [Number], // 0=Sunday, 1=Monday, ..., 6=Saturday
          default: [1, 2, 3, 4, 5], // Monday-Friday by default
        },
        timeIntervals: {
          type: [{
            start: { type: String, required: true }, // "09:00 AM"
            end: { type: String, required: true },   // "05:00 PM"
          }],
          default: [{ start: "09:00 AM", end: "05:00 PM" }],
        },
      },
      
      // Blocked dates (vacations, holidays)
      blockedDates: {
        type: [{
          title: { type: String, required: true },
          startDate: { type: Date, required: true },
          endDate: { type: Date, required: true },
          icon: { type: String, default: 'block' },
          color: { type: String, default: 'red' },
          createdAt: { type: Date, default: Date.now },
        }],
        default: [],
      },
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