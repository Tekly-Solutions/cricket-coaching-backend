import mongoose from 'mongoose';

/**
 * Earning Model
 * Tracks earnings from completed sessions
 * MVP: Read-only tracking, no payout automation
 */
const earningSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },

    // Reference to specific booking that generated this earning
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },

    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlayerProfile', // Changed from User to PlayerProfile
    },

    // Earning details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'GBP', 'EUR', 'INR', 'AUD'],
    },

    // Session info snapshot (for historical reference)
    sessionTitle: {
      type: String,
      required: true,
    },

    sessionDate: {
      type: Date,
      required: true,
      index: true,
    },

    sessionType: {
      type: String,
      enum: ['one-on-one', 'group', 'clinic', 'assessment'],
      default: 'one-on-one',
    },

    // Status tracking
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'paid', 'cancelled'],
      default: 'confirmed',
      index: true,
    },

    // Payment tracking (MVP: not used, for future)
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'platform'],
    },

    paidAt: {
      type: Date,
    },

    // For platform fees (future)
    platformFee: {
      type: Number,
      default: 0,
    },

    netAmount: {
      type: Number, // amount - platformFee
    },

    // Notes
    notes: {
      type: String,
      maxlength: 500,
    },

    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
earningSchema.index({ coach: 1, createdAt: -1 });
earningSchema.index({ coach: 1, status: 1, sessionDate: -1 });
earningSchema.index({ coach: 1, sessionDate: -1 });

// Virtual for calculating net amount
earningSchema.pre('save', async function () {
  if (this.isModified('amount') || this.isModified('platformFee')) {
    this.netAmount = this.amount - (this.platformFee || 0);
  }
});

// Static method to calculate total earnings for a coach
earningSchema.statics.getTotalEarnings = async function (coachId, status = 'confirmed') {
  const result = await this.aggregate([
    {
      $match: {
        coach: new mongoose.Types.ObjectId(coachId),
        status: { $in: Array.isArray(status) ? status : [status] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$netAmount' },
        count: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0 ? result[0] : { total: 0, count: 0 };
};

// Static method to get earnings by period
earningSchema.statics.getEarningsByPeriod = async function (
  coachId,
  startDate,
  endDate,
  groupBy = 'day'
) {
  const groupFormats = {
    day: { $dateToString: { format: '%Y-%m-%d', date: '$sessionDate' } },
    week: { $week: '$sessionDate' },
    month: { $dateToString: { format: '%Y-%m', date: '$sessionDate' } },
    year: { $year: '$sessionDate' },
  };

  return await this.aggregate([
    {
      $match: {
        coach: new mongoose.Types.ObjectId(coachId),
        status: { $in: ['confirmed', 'paid'] },
        sessionDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: groupFormats[groupBy],
        total: { $sum: '$netAmount' },
        count: { $sum: 1 },
        sessions: { $addToSet: '$session' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
};

const Earning = mongoose.model('Earning', earningSchema);

export default Earning;