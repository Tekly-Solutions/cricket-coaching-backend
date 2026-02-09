import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'GBP',
      enum: ['USD', 'GBP', 'EUR'],
    },
    interval: {
      type: String,
      enum: ['month', 'year'],
      default: 'month',
    },
    tier: {
      type: String,
      enum: ['Basic', 'Premium', 'Enterprise'],
      required: true,
    },
    trialPeriodDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    features: [{
      name: {
        type: String,
        required: true,
      },
      included: {
        type: Boolean,
        default: true,
      },
      highlight: {
        type: Boolean,
        default: false,
      },
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    // Internal plan identifier (e.g., 'free', 'pro', 'enterprise')
    planId: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('SubscriptionPlan', subscriptionPlanSchema);