import mongoose from 'mongoose';

const commissionSettingsSchema = new mongoose.Schema(
  {
    // Global commission rate (percentage)
    globalRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 12,
    },
    description: {
      type: String,
      default: 'Default commission rate applied to all sports and coaches unless specified otherwise.',
    },
    // Sport-specific commission rates
    sportRates: [{
      sportName: {
        type: String,
        required: true,
        trim: true,
      },
      sportIcon: {
        type: String,
        default: 'sports',
      },
      sportCategory: {
        type: String,
        trim: true,
      },
      commissionRate: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      status: {
        type: String,
        enum: ['active', 'paused'],
        default: 'active',
      },
      activeSince: {
        type: Date,
        default: Date.now,
      },
    }],
    // User-specific commission overrides (Guardian/Parent)
    userOverrides: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      commissionRate: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      source: {
        type: String,
        default: 'Manual Override',
        trim: true,
      },
      status: {
        type: String,
        enum: ['active', 'scheduled', 'expired'],
        default: 'active',
      },
      effectiveFrom: {
        type: Date,
        default: Date.now,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
    }],
    // Last updated by admin
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
commissionSettingsSchema.index({ 'sportRates.sportName': 1 });
commissionSettingsSchema.index({ 'userOverrides.userId': 1 });

// Static method to get or create singleton settings
commissionSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      globalRate: 12,
      description: 'Default commission rate applied to all sports and coaches unless specified otherwise.',
    });
  }
  return settings;
};

// Method to calculate commission for a booking
commissionSettingsSchema.methods.calculateCommission = function (
  sessionFee,
  userId = null,
  sportName = null
) {
  let rate = this.globalRate;

  // Check for user-specific override (highest priority)
  if (userId) {
    const userOverride = this.userOverrides.find(
      (override) =>
        override.userId.toString() === userId.toString() &&
        override.status === 'active' &&
        (!override.expiresAt || override.expiresAt > new Date())
    );
    if (userOverride) {
      rate = userOverride.commissionRate;
      return {
        rate,
        amount: (sessionFee * rate) / 100,
        appliedRule: 'user-override',
      };
    }
  }

  // Check for sport-specific rate (second priority)
  if (sportName) {
    const sportRate = this.sportRates.find(
      (sport) =>
        sport.sportName.toLowerCase() === sportName.toLowerCase() &&
        sport.status === 'active'
    );
    if (sportRate) {
      rate = sportRate.commissionRate;
      return {
        rate,
        amount: (sessionFee * rate) / 100,
        appliedRule: 'sport-specific',
      };
    }
  }

  // Use global rate (default)
  return {
    rate,
    amount: (sessionFee * rate) / 100,
    appliedRule: 'global',
  };
};

export default mongoose.model('CommissionSettings', commissionSettingsSchema);