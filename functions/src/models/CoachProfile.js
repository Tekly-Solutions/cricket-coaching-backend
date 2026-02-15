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

    // Location
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    // Default Pricing for Individual Bookings
    defaultPricing: {
      hourlyRate: {
        type: Number,
        min: 0,
        default: 0,
      },
      currency: {
        type: String,
        default: 'USD',
      },
      sessionDuration: {
        type: Number,  // in minutes
        default: 60,
        min: 15,
        max: 240,
      },
    },

    // Configuration for 1-on-1 bookings
    bookingSettings: {
      bufferTime: {
        type: Number,
        default: 15, // minutes
        min: 0,
      },
      minAdvanceBookingHours: {
        type: Number,
        default: 24, // How many hours in advance to book
        min: 1,
      },
      maxAdvanceBookingDays: {
        type: Number,
        default: 30, // How many days in advance max
        min: 1,
      },
      cancellationPolicy: {
        type: String,
        enum: ["flexible", "moderate", "strict"],
        default: "flexible",
      },
      autoAccept: {
        type: Boolean,
        default: true,
      },
    },

    aboutMe: {
      type: String,
      maxlength: 1200,
      trim: true,
      // bio shown in Edit Profile & possibly public coach profile
    },

    // Cricket-specific details
    coachingPhilosophy: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    notableAchievements: {
      type: [String],
      default: [],
      // e.g., ["Coached U19 State Team", "Former First Class Player"]
    },

    playingCareerBackground: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    ageGroupsCoached: {
      type: [String],
      default: [],
      // e.g., ["U12", "U15", "U19", "Senior", "Professional"]
    },

    sessionTypesOffered: {
      type: [String],
      default: [],
      // e.g., ["1-on-1", "Group Training", "Video Analysis", "Fitness Training"]
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
        // Per-day schedules (0=Monday, 1=Tuesday, ..., 6=Sunday)
        daySchedules: {
          type: Map,
          of: [{
            start: { type: String, required: true }, // "09:00 AM"
            end: { type: String, required: true },   // "05:00 PM"
          }],
          default: () => ({
            '0': [{ start: "09:00 AM", end: "05:00 PM" }], // Monday
            '1': [{ start: "09:00 AM", end: "05:00 PM" }], // Tuesday
            '2': [{ start: "09:00 AM", end: "05:00 PM" }], // Wednesday
            '3': [{ start: "09:00 AM", end: "05:00 PM" }], // Thursday
            '4': [{ start: "09:00 AM", end: "05:00 PM" }], // Friday
            '5': [], // Saturday - no schedule
            '6': [], // Sunday - no schedule
          }),
        },
        // Legacy fields for backward compatibility
        activeDays: {
          type: [Number],
          default: undefined,
        },
        timeIntervals: {
          type: [{
            start: { type: String },
            end: { type: String },
          }],
          default: undefined,
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

      // Date-specific availability overrides (takes precedence over recurring schedule)
      dateOverrides: {
        type: [{
          date: { type: String, required: true }, // YYYY-MM-DD format
          schedule: {
            type: [{
              start: { type: String, required: true }, // "09:00 AM"
              end: { type: String, required: true },   // "05:00 PM"
            }],
            required: true,
          },
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