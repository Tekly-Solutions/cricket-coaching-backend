import mongoose from 'mongoose';

const timeSlotSchema = new mongoose.Schema({
  startTime: {
    type: Date,           // full ISO date + time (e.g. 2025-04-15T09:00:00.000Z)
    required: true,
  },
  endTime: {
    type: Date,           // calculated = startTime + duration
    required: true,
  },
  durationMinutes: {
    type: Number,
    min: 15,
    max: 240,
    required: true,
  },
  bookedCount: {
    type: Number,
    default: 0,
    min: 0,
  },
});

const sessionSchema = new mongoose.Schema(
  {
    coach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 800,
    },

    location: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    // --- NEW FIELDS FOR WIZARD ---

    sessionType: {
      type: String,
      enum: ['one-time', 'recurring', 'camp', 'tournament'],
      default: 'one-time',
    },

    focusAreas: [{
      type: String, // e.g., 'Batting', 'Bowling', 'Fielding', 'Fitness'
      trim: true,
    }],

    skillLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Professional', 'All Levels'],
      default: 'All Levels',
    },

    ageGroups: [{
      type: String, // e.g., 'Under 11', 'Under 13', 'Under 15', 'Open'
      trim: true,
    }],

    // Enhanced Recurring Pattern
    recurringPattern: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'bi-weekly', 'monthly', 'custom'],
      },
      daysOfWeek: [{ // For weekly: ['monday', 'wednesday']
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      }],
      startDate: { type: Date },
      endDate: { type: Date },
      totalSessions: { type: Number },
      exceptions: [{ type: Date }], // Dates to skip
    },

    // Enhanced Capacity
    capacity: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 18 },
    },

    // Enhanced Pricing
    pricing: {
      model: {
        type: String,
        enum: ['per-session', 'full-series'],
        default: 'per-session',
      },
      amount: {
        type: Number,
        min: 0,
        default: 0,
      },
      currency: {
        type: String,
        default: 'USD',
      },
    },

    // Enrollment & Policies
    enrollmentSettings: {
      autoAccept: { type: Boolean, default: true },
      allowWaitlist: { type: Boolean, default: false },
      sendReminders: { type: Boolean, default: true },
      deadlineHoursBefore: { type: Number, default: 0 },
    },

    cancellationPolicy: {
      type: String,
      enum: ['flexible', 'moderate', 'strict'],
      default: 'flexible',
    },

    equipmentRequired: [{
      type: String,
      trim: true,
    }],

    timeSlots: [timeSlotSchema],

    // -----------------------------

    // Players already assigned / invited
    assignedPlayers: [{
      player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlayerProfile',
      },
      status: {
        type: String,
        enum: ['invited', 'confirmed', 'declined', 'waitlisted', 'pending'],
        default: 'invited',
      },
      joinedAt: { type: Date },
      attended: {
        type: Boolean,
        default: false,
      },
      note: {
        type: String,
        default: '',
      },
      report: {
        // 0. Performance Ratings
        technicalRating: { type: Number, min: 0, max: 5, default: 0 },
        physicalRating: { type: Number, min: 0, max: 5, default: 0 },
        mentalRating: { type: Number, min: 0, max: 5, default: 0 },

        // 1. Overview
        primaryFocus: { type: String, default: '' },

        // 2. Strengths & Positives
        technicalWins: { type: String, default: '' },
        progress: { type: String, default: '' },
        intangibles: { type: String, default: '' },

        // 3. Areas for Improvement
        technicalFlaws: { type: String, default: '' },
        tacticalMentalAspects: { type: String, default: '' },

        // 4. Action Plan / Homework
        specificDrills: { type: String, default: '' },
        fitnessConditioning: { type: String, default: '' },

        // 5. Looking Ahead
        goalForNextSession: { type: String, default: '' },
        closingEncouragement: { type: String, default: '' },
      }
    }],

    sessionNotes: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'in-progress', 'cancelled', 'completed'],
      default: 'draft',
    },

    createdBy: {   // same as coach, but useful for audit
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Indexes for performance
sessionSchema.index({ coach: 1, 'timeSlots.startTime': 1 });
sessionSchema.index({ 'assignedPlayers.player': 1 });
sessionSchema.index({ sessionType: 1 });
sessionSchema.index({ status: 1 });

export default mongoose.model('Session', sessionSchema);