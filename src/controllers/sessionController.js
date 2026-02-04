// controllers/sessionController.js
import Session from '../models/Session.js';
import mongoose from 'mongoose';

// Helper function to generate concrete time slots
function generateTimeSlots(selectedDates, timeSlotsTemplate) {
  const occurrences = [];

  selectedDates.forEach((dateStr) => {
    const day = new Date(dateStr);
    if (isNaN(day.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    timeSlotsTemplate.forEach((slot) => {
      const start = new Date(day);
      start.setHours(slot.startTime.hour, slot.startTime.minute, 0, 0);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + slot.durationMinutes);

      occurrences.push({
        startTime: start,
        endTime: end,
        durationMinutes: slot.durationMinutes,
        bookedCount: 0,
      });
    });
  });

  return occurrences;
}

export const createSession = async (req, res) => {
  try {

    const {
      title,
      description,
      location,
      capacity = 18,
      timeSlots = [],
      explicitTimeSlots = [], // New parameter for specific slots
      selectedDays = [],
      isRecurring = false,
      participants = [],
    } = req.body;

    const userId = req.user.userId;

    // Basic validation
    if (!title?.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Session title is required',
      });
    }

    let concreteSlots = [];

    // CASE 1: Explicit Time Slots (New Logic)
    // Used when frontend provides exact timestamps for every slot
    if (explicitTimeSlots && explicitTimeSlots.length > 0) {
      concreteSlots = explicitTimeSlots.map((slot, index) => {
        const startTime = new Date(slot.startTime);
        if (isNaN(startTime.getTime())) {
          throw new Error(`Invalid start time in explicit slot ${index + 1}`);
        }

        const duration = Number(slot.durationMinutes);
        if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
          throw new Error(`Duration must be between 15 and 240 minutes in explicit slot ${index + 1}`);
        }

        const endTime = new Date(startTime);
        endTime.setMinutes(startTime.getMinutes() + duration);

        return {
          startTime,
          endTime,
          durationMinutes: duration,
          bookedCount: 0
        };
      });
    }
    // CASE 2: Template-based Generation (Old Logic)
    // Used when frontend provides days + template slots (Cartesian product)
    else {
      if (!selectedDays?.length) {
        return res.status(400).json({
          status: 'error',
          message: 'At least one date must be selected',
        });
      }

      if (!timeSlots?.length) {
        return res.status(400).json({
          status: 'error',
          message: 'At least one time slot is required',
        });
      }

      // Validate and normalize timeSlots
      const formattedTimeSlots = timeSlots.map((s, index) => {
        if (
          !s.startTime ||
          typeof s.startTime.hour !== 'number' ||
          typeof s.startTime.minute !== 'number'
        ) {
          throw new Error(`Invalid start time format in slot ${index + 1}`);
        }
        if (
          !Number.isInteger(s.durationMinutes) ||
          s.durationMinutes < 15 ||
          s.durationMinutes > 240
        ) {
          throw new Error(
            `Duration must be between 15 and 240 minutes in slot ${index + 1}`
          );
        }
        return {
          startTime: {
            hour: Number(s.startTime.hour),
            minute: Number(s.startTime.minute || 0),
          },
          durationMinutes: Number(s.durationMinutes),
        };
      });

      concreteSlots = generateTimeSlots(selectedDays, formattedTimeSlots);
    }

    // Check for session conflicts (overlapping time slots)
    for (const slot of concreteSlots) {
      const conflictingSessions = await Session.find({
        coach: userId,
        status: { $nin: ['cancelled'] },
        $or: [
          // New session starts during an existing session
          {
            'timeSlots.startTime': { $lte: slot.startTime },
            'timeSlots.endTime': { $gt: slot.startTime },
          },
          // New session ends during an existing session
          {
            'timeSlots.startTime': { $lt: slot.endTime },
            'timeSlots.endTime': { $gte: slot.endTime },
          },
          // New session completely contains an existing session
          {
            'timeSlots.startTime': { $gte: slot.startTime },
            'timeSlots.endTime': { $lte: slot.endTime },
          },
        ],
      });

      if (conflictingSessions.length > 0) {
        const conflictDate = slot.startTime.toLocaleDateString();
        const conflictTime = slot.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return res.status(400).json({
          status: 'error',
          message: `Session conflict: You already have a session scheduled on ${conflictDate} at ${conflictTime}`,
        });
      }
    }

    const session = await Session.create({
      coach: userId,
      createdBy: userId,
      title: title.trim(),
      description: description?.trim() || '',
      location: location?.trim() || '',
      capacity: Number(capacity),
      isRecurring,
      recurrencePattern: isRecurring ? 'custom' : 'none',
      timeSlots: concreteSlots,
      assignedPlayers: participants.map((playerId) => ({
        player: playerId,
        status: 'invited',
      })),
      status: 'draft',
    });

    return res.status(201).json({
      status: 'success',
      data: session,
    });
  } catch (error) {
    console.error('Create session error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create session',
    });
  }
};

/**
 * GET /api/sessions
 * List coach sessions with optional filtering
 * Query params:
 *   - type: upcoming | past | all (default: all)
 *   - limit: number (default 10)
 *   - page: number (default 1)
 *   - status: draft | published | completed | cancelled (optional)
 */
export const getCoachSessions = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Query params
    const type = (req.query.type || 'all').toLowerCase();
    const dateParam = req.query.date; // YYYY-MM-DD
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const now = new Date();

    // Base query
    const query = { coach: userId };

    // 📅 DATE FILTERING
    if (dateParam) {
      const selectedDate = new Date(dateParam);
      if (!isNaN(selectedDate.getTime())) {
        // Start of day (00:00:00)
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        // End of day (23:59:59)
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Find sessions that have at least one time slot overlapping with this day
        // OR simpler: specific time slot starts within this day
        query['timeSlots.startTime'] = {
          $gte: startOfDay,
          $lte: endOfDay,
        };

        // Ensure we don't show cancelled sessions for the day usage
        query.status = { $ne: 'cancelled' };
      }
    }
    // FALLBACK TO TYPE FILTERING IF NO DATE
    else {
      // Filter by type
      if (type === 'upcoming') {
        query['timeSlots.startTime'] = { $gt: now };
        query.status = { $nin: ['cancelled', 'completed'] };
      } else if (type === 'past') {
        query.$or = [
          { 'timeSlots.endTime': { $lt: now } },
          { status: 'completed' },
        ];
      }
      // 'all' → no extra filter
    }

    // Optional extra status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Fetch sessions
    const sessions = await Session.find(query)
      .sort({ 'timeSlots.startTime': 1 }) // Always sort by time ascending for calendar/upcoming
      .skip(skip)
      .limit(limit)
      .populate('assignedPlayers.player', 'fullName profilePhoto')
      .lean();

    // Total count for pagination
    const total = await Session.countDocuments(query);

    return res.status(200).json({
      status: 'success',
      results: sessions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      type, // echo back the type for frontend clarity
      date: dateParam,
      data: sessions,
    });
  } catch (error) {
    console.error('List coach sessions error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sessions',
    });
  }
};

export const getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('assignedPlayers.player', 'fullName profilePhoto email')
      .populate('coach', 'fullName profilePhoto')
      .populate('createdBy', 'fullName profilePhoto email')
      .lean();

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: session,
    });
  } catch (error) {
    console.error('Get session by ID error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch session',
    });
  }
};

export const updateSession = async (req, res) => {
  try {
    const allowedFields = ['title', 'description', 'location', 'capacity', 'pricing'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields to update',
      });
    }

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, coach: req.user.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found or you are not authorized',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: session,
    });
  } catch (error) {
    console.error('Update session error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to update session',
    });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const session = await Session.findOneAndDelete({
      _id: req.params.id,
      coach: req.user.userId,
    });

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found or not authorized',
      });
    }

    return res.status(204).json({
      status: 'success',
      message: 'Session deleted successfully',
      data: null,
    });
  } catch (error) {
    console.error('Delete session error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to delete session',
    });
  }
};

export const addPlayerToSession = async (req, res) => {
  try {
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        status: 'error',
        message: 'playerId is required',
      });
    }

    // Optional: Validate that playerId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(playerId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid playerId format',
      });
    }

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, coach: req.user.userId },
      {
        $addToSet: {
          assignedPlayers: { player: playerId, status: 'invited' },
        },
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found or not authorized',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: session,
    });
  } catch (error) {
    console.error('Add player to session error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to add player',
    });
  }
};

/**
 * GET /api/sessions/stats
 * Returns quick counts: upcoming, past, total
 */
export const getSessionStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();

    // Total sessions (all time)
    const totalCount = await Session.countDocuments({ coach: userId });

    // Upcoming: future start time, not cancelled/completed
    const upcomingCount = await Session.countDocuments({
      coach: userId,
      status: { $nin: ['cancelled', 'completed'] },
      'timeSlots.startTime': { $gt: now },
    });

    // Past: ended before now, or marked completed
    const pastCount = await Session.countDocuments({
      coach: userId,
      $or: [
        { 'timeSlots.endTime': { $lt: now } },
        { status: 'completed' },
      ],
    });

    return res.status(200).json({
      status: 'success',
      data: {
        total: totalCount,
        upcoming: upcomingCount,
        past: pastCount,
      },
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch session stats',
    });
  }
};