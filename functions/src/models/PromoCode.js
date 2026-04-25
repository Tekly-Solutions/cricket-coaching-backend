import mongoose from "mongoose";

const promoCodeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 50,
    },
    
    category: {
      type: String,
      enum: ["subscription", "commission", "booking"],
      required: true,
    },
    
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    
    minimumPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    
    startDate: {
      type: Date,
      required: true,
    },
    
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    
    durationUnit: {
      type: String,
      enum: ["days", "months", "years"],
      required: true,
      default: "months",
    },
    
    endDate: {
      type: Date,
      required: false, // Auto-calculated in pre-save hook
    },
    
    usageLimitEnabled: {
      type: Boolean,
      default: true,
    },
    
    // For subscription category
    maxRedemptions: {
      type: Number,
      min: 0,
      default: null,
      required: function() {
        return this.category === "subscription" && this.usageLimitEnabled;
      },
    },
    
    // For commission category
    totalUsageLimit: {
      type: Number,
      min: 0,
      default: null,
      required: function() {
        return this.category === "commission" && this.usageLimitEnabled;
      },
    },
    
    limitPerUser: {
      type: Number,
      min: 0,
      default: null,
      required: function() {
        return this.category === "commission" && this.usageLimitEnabled;
      },
    },
    
    preventStacking: {
      type: Boolean,
      default: true,
    },
    
    // Applicable to subscription category
    applicablePlans: {
      type: [String],
      default: [],
      validate: {
        validator: function(plans) {
          if (this.category === "subscription") {
            return plans && plans.length > 0;
          }
          return true;
        },
        message: "At least one plan must be selected for subscription discounts",
      },
    },
    
    // Applicable to commission category
    targetUserRole: {
      type: String,
      enum: ["parents", "coaches", "all"],
      default: "all",
      required: function() {
        return this.category === "commission";
      },
    },
    
    selectedSports: {
      type: [String],
      default: [],
      validate: {
        validator: function(sports) {
          if (this.category === "commission") {
            return sports && sports.length > 0;
          }
          return true;
        },
        message: "At least one sport must be selected for commission discounts",
      },
    },
    
    applyToFutureSports: {
      type: Boolean,
      default: false,
    },
    
    status: {
      type: String,
      enum: ["draft", "active", "expired", "disabled"],
      default: "draft",
    },
    
    // Usage tracking
    currentRedemptions: {
      type: Number,
      default: 0,
      min: 0,
    },
    
    // Track who used this promo code
    usageHistory: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      usedAt: {
        type: Date,
        default: Date.now,
      },
      orderValue: {
        type: Number,
        default: 0,
      },
      discountApplied: {
        type: Number,
        default: 0,
      },
    }],
    
    // Admin who created this promo
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { 
    timestamps: true,
  }
);

// Indexes for better query performance
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ status: 1, category: 1 });
promoCodeSchema.index({ endDate: 1 });
promoCodeSchema.index({ category: 1, status: 1 });

// Virtual to check if promo is currently valid
promoCodeSchema.virtual('isValid').get(function() {
  const now = new Date();
  return (
    this.status === 'active' &&
    this.startDate <= now &&
    this.endDate >= now &&
    (!this.usageLimitEnabled || this.currentRedemptions < (this.maxRedemptions || this.totalUsageLimit || Infinity))
  );
});

// Ensure virtuals are included when converting to JSON
promoCodeSchema.set('toJSON', { virtuals: true });
promoCodeSchema.set('toObject', { virtuals: true });

export default mongoose.model("PromoCode", promoCodeSchema);