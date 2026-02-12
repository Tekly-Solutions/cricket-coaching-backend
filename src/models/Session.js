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

    // single vs recurring
    isRecurring: {
      type: Boolean,
      default: false,
    },

    // For recurring: helps frontend show pattern (not enforced by DB)
    recurrencePattern: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'custom'],
      default: 'none',
    },

    // Main list of concrete occurrences
    timeSlots: [timeSlotSchema],

    // Max players per slot / per occurrence
    capacity: {
      type: Number,
      min: 1,
      max: 50,
      default: 18,
    },

    // Pricing for this specific session
    pricing: {
      amount: {
        type: Number,
        min: 0,
        default: 0,
      },
      currency: {
        type: String,
        default: 'USD',
      },
      pricePerPerson: {
        type: Boolean,
        default: true,  // true = per person, false = per session
      },
    },

    // Players already assigned / invited
    assignedPlayers: [{
      player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PlayerProfile',
      },
      status: {
        type: String,
        enum: ['invited', 'confirmed', 'declined', 'waitlisted'],
        default: 'invited',
      },
      joinedAt: { type: Date },
      attended: {
        type: Boolean,
        default: false,
      },
    }],

    status: {
      type: String,
      enum: ['draft', 'published', 'cancelled', 'completed'],
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

export default mongoose.model('Session', sessionSchema);