// controllers/sessionController.js
import Session from '../models/Session.js';
import mongoose from 'mongoose';

// Helper function to generate concrete time slots
function generateTimeSlots(selectedDates, timeSlotsTemplate) {
  console.log('generateTimeSlots called with:', JSON.stringify({ selectedDates, timeSlotsTemplate }));
  const occurrences = [];

  selectedDates.forEach((dateStr) => {
    const day = new Date(dateStr);
    if (isNaN(day.getTime())) {
      console.error(`Invalid date format: ${dateStr}`);
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    timeSlotsTemplate.forEach((slot) => {
      const start = new Date(day);
      start.setHours(slot.startTime.hour, slot.startTime.minute, 0, 0);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + slot.durationMinutes);

      console.log(`Generated slot: ${start.toISOString()} - ${end.toISOString()}`);

      occurrences.push({
        startTime: start,
        endTime: end,
        durationMinutes: slot.durationMinutes,
        bookedCount: 0,
      });
    });
  });

  console.log(`generateTimeSlots returning ${occurrences.length} slots`);
  return occurrences;
}

export const createSession = async (req, res) => {
  try {

    const {
      title,
      description,
      location,
      sessionType = 'one-time',
      focusAreas = [],
      skillLevel = 'All Levels',
      ageGroups = [],
      recurringPattern,
      capacity = { min: 1, max: 18 },
      pricing = { model: 'per-session', amount: 0, currency: 'USD' },
      enrollmentSettings = { autoAccept: true },
      cancellationPolicy = 'flexible',
      equipmentRequired = [],
      timeSlots = [],
      explicitTimeSlots = [],
      selectedDays = [], // Legacy/Manual single dates
      participants = [],
    } = req.body;

    const userId = req.user.userId;

    // Basic validation
    if (!title?.trim()) {
      return res.status(400).json({ status: 'error', message: 'Session title is required' });
    }

    console.log('Creates session raw body:', JSON.stringify(req.body, null, 2));

    let concreteSlots = [];

    // --- STRATEGY 1: Explicit Time Slots (Pre-calculated) ---
    if (explicitTimeSlots && explicitTimeSlots.length > 0) {
      concreteSlots = explicitTimeSlots.map((slot, index) => {
        const startTime = new Date(slot.startTime);
        if (isNaN(startTime.getTime())) throw new Error(`Invalid start time in slot ${index + 1}`);
        const duration = Number(slot.durationMinutes);
        if (!Number.isInteger(duration) || duration < 15 || duration > 480) { // Increased max for camps
          throw new Error(`Duration valid range 15-480 min in slot ${index + 1}`);
        }
        const endTime = new Date(startTime);
        endTime.setMinutes(startTime.getMinutes() + duration);
        return { startTime, endTime, durationMinutes: duration, bookedCount: 0 };
      });
    }
    // --- STRATEGY 2: Recurring Pattern Generation (New Wizard Logic) ---
    else if (sessionType === 'recurring' && recurringPattern?.startDate && recurringPattern?.endDate) {
      if (!timeSlots?.length) {
        return res.status(400).json({ status: 'error', message: 'Time template required for recurring sessions' });
      }

      const start = new Date(recurringPattern.startDate);
      const end = new Date(recurringPattern.endDate);
      const days = (recurringPattern.daysOfWeek || []).map(d => d.toLowerCase());
      const exceptions = (recurringPattern.exceptions || []).map(d => new Date(d).toDateString());

      // Map day names to 0-6
      const dayMap = { 'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6 };
      const targetDays = days.map(d => dayMap[d]).filter(d => d !== undefined);

      const current = new Date(start);

      while (current <= end) {
        if (targetDays.includes(current.getDay())) {
          // Check exception
          if (!exceptions.includes(current.toDateString())) {
            // Determine time from template
            // Assuming timeSlots[0] contains the daily schedule time
            // We'll iterate all template slots for this day
            timeSlots.forEach(template => {
              const slotStart = new Date(current);
              slotStart.setHours(template.startTime.hour, template.startTime.minute, 0, 0);

              const duration = Number(template.durationMinutes);
              const slotEnd = new Date(slotStart);
              slotEnd.setMinutes(slotStart.getMinutes() + duration);

              concreteSlots.push({
                startTime: slotStart,
                endTime: slotEnd,
                durationMinutes: duration,
                bookedCount: 0
              });
            });
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }
    // --- STRATEGY 3: Manual Day Selection (Legacy) ---
    else {
      if (!selectedDays?.length) {
        return res.status(400).json({ status: 'error', message: 'At least one date must be selected' });
      }
      if (!timeSlots?.length) {
        return res.status(400).json({ status: 'error', message: 'At least one time slot is required' });
      }

      // Validate and normalize timeSlots
      const formattedTimeSlots = timeSlots.map((s, index) => {
        if (!s.startTime || typeof s.startTime.hour !== 'number') {
          throw new Error(`Invalid start time format in slot ${index + 1}`);
        }
        return {
          startTime: { hour: Number(s.startTime.hour), minute: Number(s.startTime.minute || 0) },
          durationMinutes: Number(s.durationMinutes),
        };
      });

      concreteSlots = generateTimeSlots(selectedDays, formattedTimeSlots);
    }

    console.log('Generated concreteSlots:', JSON.stringify(concreteSlots, null, 2));

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
      // New Fields
      sessionType,
      focusAreas,
      skillLevel,
      ageGroups,
      recurringPattern,
      capacity: typeof capacity === 'object' ? capacity : { max: Number(capacity), min: 1 },
      pricing,
      enrollmentSettings,
      cancellationPolicy,
      equipmentRequired,
      // Existing / Backward Compatibility
      isRecurring: sessionType === 'recurring',
      recurrencePattern: sessionType === 'recurring' ? 'custom' : 'none',
      timeSlots: concreteSlots,
      assignedPlayers: participants.map((playerId) => ({
        player: playerId,
        status: 'invited',
      })),
      status: req.body.status || 'published',
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
    // Frontend sends startDate/endDate as UTC ISO strings for the user's LOCAL day.
    // Using bare 'YYYY-MM-DD' (old 'date' param) caused UTC-midnight misparse:
    // e.g. IST 9AM slot = 03:30 UTC → appeared on the PREVIOUS UTC date.
    const startDateParam = req.query.startDate; // UTC ISO, e.g. '2026-03-01T18:30:00.000Z'
    const endDateParam = req.query.endDate;   // UTC ISO, e.g. '2026-03-02T18:29:59.999Z'
    const isDateRequest = !!(startDateParam && endDateParam);
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const now = new Date();

    // Base query
    const query = { coach: userId };

    // 📅 DATE FILTERING — boundaries already in UTC, use them directly
    if (isDateRequest) {
      const startOfDay = new Date(startDateParam);
      const endOfDay = new Date(endDateParam);
      if (!isNaN(startOfDay.getTime()) && !isNaN(endOfDay.getTime())) {
        query['timeSlots.startTime'] = { $gte: startOfDay, $lte: endOfDay };
        query.status = { $ne: 'cancelled' };
      }
    }
    // TYPE FILTERING (broad DB pass; refined per-slot in JS below)
    else {
      if (type === 'upcoming') {
        // Fetch sessions that have AT LEAST ONE future slot
        query['timeSlots.endTime'] = { $gt: now };
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
      .sort({ 'timeSlots.startTime': 1 })
      .skip(skip)
      .limit(limit)
      .populate('assignedPlayers.player', 'fullName profilePhoto')
      .lean();

    const total = await Session.countDocuments(query);

    // ─── Enrich each session with displaySlot + isFinished ──────────────────
    // Recurring sessions have MANY time slots (one per day). We pick the
    // correct one to show so cards always display the relevant occurrence:
    //   date filter  → slot matching that calendar day
    //   upcoming     → earliest slot whose endTime is still in the future
    //   past         → most recent slot whose endTime is already in the past
    //   all          → next future slot, falling back to most recent past
    const enrichedSessions = sessions.map((session) => {
      const slots = session.timeSlots || [];
      let displaySlot = null;

      if (isDateRequest) {
        const startOfDay = new Date(startDateParam);
        displaySlot =
          slots.find((s) => {
            const d = new Date(s.startTime);
            return d >= startOfDay && d <= new Date(endDateParam);
          }) || slots[0];
      } else if (type === 'past') {
        // Most recent slot that has already ended
        const pastSlots = slots.filter((s) => new Date(s.endTime) <= now);
        displaySlot =
          pastSlots.length > 0
            ? pastSlots.reduce((latest, s) =>
              new Date(s.endTime) > new Date(latest.endTime) ? s : latest
            )
            : slots[slots.length - 1] || slots[0];
      } else {
        // upcoming / all: earliest slot whose end time is still in the future
        const futureSlots = slots.filter((s) => new Date(s.endTime) > now);
        if (futureSlots.length > 0) {
          displaySlot = futureSlots.reduce((earliest, s) =>
            new Date(s.startTime) < new Date(earliest.startTime) ? s : earliest
          );
        } else {
          // All slots done – fall back to most recent past slot
          const pastSlots = slots.filter((s) => new Date(s.endTime) <= now);
          displaySlot =
            pastSlots.length > 0
              ? pastSlots.reduce((latest, s) =>
                new Date(s.endTime) > new Date(latest.endTime) ? s : latest
              )
              : slots[0];
        }
      }

      // isFinished: display slot has ended OR session explicitly completed
      const isFinished =
        session.status === 'completed' ||
        (displaySlot != null && new Date(displaySlot.endTime) <= now);

      return { ...session, displaySlot: displaySlot || null, isFinished };
    });

    // For 'upcoming', remove sessions where ALL slots are finished (no future occurrence)
    const filteredSessions =
      !isDateRequest && type === 'upcoming'
        ? enrichedSessions.filter((s) => !s.isFinished)
        : enrichedSessions;
    // ────────────────────────────────────────────────────────────────────────

    return res.status(200).json({
      status: 'success',
      results: filteredSessions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      type,
      startDate: startDateParam,
      endDate: endDateParam,
      sessions: filteredSessions,
      data: filteredSessions, // backward-compat alias
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
      .populate({
        path: 'coach',
        select: 'role fullName profilePhoto phoneNumber',
        populate: {
          path: 'coachProfile',
          select: 'fullName profilePhoto coachTitle'
        }
      })
      .populate('createdBy', 'fullName profilePhoto email phoneNumber')
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
    const { playerIds } = req.body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'playerIds array is required',
      });
    }

    // Create array of player objects to add
    const playersToAdd = playerIds.map(id => ({
      player: id,
      status: 'invited'
    }));

    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, coach: req.user.userId },
      {
        $addToSet: {
          assignedPlayers: { $each: playersToAdd },
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
    console.error('Add players to session error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to add players',
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

/**
 * PUT /api/sessions/:id/players/:playerId/attendance
 * Update attendance status for a player in a session
 */
export const updateSessionAttendance = async (req, res) => {
  try {
    const { id, playerId } = req.params;
    const { attended } = req.body;

    if (attended === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'attended status is required',
      });
    }

    const session = await Session.findOneAndUpdate(
      {
        _id: id,
        coach: req.user.userId,
        'assignedPlayers.player': playerId
      },
      {
        $set: {
          'assignedPlayers.$.attended': attended
        }
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session or player not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Attendance updated',
      data: session
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update attendance',
    });
  }
};

/**
 * POST /api/sessions/:id/start
 * Marks a session as in-progress
 */
export const startSession = async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, coach: req.user.userId },
      { $set: { status: 'in-progress' } },
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
    console.error('Start session error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to start session',
    });
  }
};

import Notification from '../models/Notification.js';
import Booking from '../models/Booking.js';
import PlayerProfile from '../models/PlayerProfile.js';

/**
 * POST /api/sessions/:id/complete
 * Marks a session as completed, optionally saves notes
 */
export const completeSession = async (req, res) => {
  try {
    const { sessionNotes } = req.body;
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, coach: req.user.userId },
      {
        $set: {
          status: 'completed',
          sessionNotes: sessionNotes || ''
        }
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session not found or not authorized',
      });
    }

    // Trigger Notification to players/guardians to leave a review
    try {
      const bookings = await Booking.find({
        session: session._id,
        status: { $in: ['confirmed', 'completed'] },
      }).populate('player');

      const userIdsToNotify = new Set();

      for (const booking of bookings) {
        if (booking.player) {
          if (booking.player.userId) {
            userIdsToNotify.add(booking.player.userId.toString());
          } else if (booking.player.guardianId) {
            userIdsToNotify.add(booking.player.guardianId.toString());
          }
        }
      }

      const notificationPromises = Array.from(userIdsToNotify).map(userId =>
        Notification.create({
          recipient: userId,
          sender: req.user.userId, // Coach who completed the session
          type: 'new_review', // Can use system or new_review. Let's use new_review
          category: 'Performance',
          title: 'Session Completed!',
          description: `The session "${session.title}" has been completed. Please take a moment to leave a review for the coach.`,
          relatedEntity: {
            entityType: 'session',
            entityId: session._id,
          },
          actionButton: {
            text: 'Leave Review',
            action: 'view_review',
            url: `/add-review`,
          },
          metadata: {
            sessionId: session._id.toString(),
            coachId: req.user.userId.toString(),
            sessionTitle: session.title,
            coachName: req.user.fullName || 'Coach',
          }
        })
      );

      await Promise.all(notificationPromises);
    } catch (notifErr) {
      console.error('Error sending review notifications:', notifErr);
      // We don't fail the completeSession request if notifications fail
    }

    return res.status(200).json({
      status: 'success',
      data: session,
    });
  } catch (error) {
    console.error('Complete session error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to complete session',
    });
  }
};

/**
 * PUT /api/sessions/:id/players/:playerId/report
 * Create or update a detailed performance report for a player
 */
export const updatePlayerReport = async (req, res) => {
  try {
    const { id, playerId } = req.params;
    const { report } = req.body;

    if (!report) {
      return res.status(400).json({
        status: 'error',
        message: 'report object is required',
      });
    }

    const session = await Session.findOneAndUpdate(
      {
        _id: id,
        coach: req.user.userId,
        'assignedPlayers.player': playerId
      },
      {
        $set: {
          'assignedPlayers.$.report': report
        }
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Session or player not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Player report updated',
      data: session
    });
  } catch (error) {
    console.error('Update player report error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update player report',
    });
  }
};

// Get all session reports for a specific player (for guardian/player view)
export const getPlayerReports = async (req, res) => {
  try {
    const { playerId } = req.params;

    // Find ALL sessions where this player was assigned (no status filter)
    const sessions = await Session.find({
      'assignedPlayers.player': playerId,
    })
      .populate('coach', 'fullName profileUrl profilePhoto email')
      .select('title date timeSlots assignedPlayers coach status createdAt')
      .sort({ createdAt: -1 });

    // Extract only the relevant player's report data from each session
    const reports = [];
    for (const session of sessions) {
      const playerEntry = session.assignedPlayers.find(
        (ap) => ap.player?.toString() === playerId
      );

      if (!playerEntry) continue;

      const report = playerEntry.report;
      const hasAnyData = report && (
        report.technicalRating > 0 ||
        report.physicalRating > 0 ||
        report.mentalRating > 0 ||
        report.primaryFocus ||
        report.technicalWins ||
        report.progress ||
        report.closingEncouragement
      );

      // Always include so guardian can see attended sessions,
      // but mark whether a report was written or not
      const sessionDate = session.timeSlots?.[0]?.startTime ?? session.createdAt;

      reports.push({
        sessionId: session._id,
        sessionTitle: session.title,
        sessionDate,
        sessionStatus: session.status,
        coach: session.coach,
        attended: playerEntry.attended,
        hasReport: !!hasAnyData,
        // Ratings
        technicalRating: report?.technicalRating ?? 0,
        physicalRating: report?.physicalRating ?? 0,
        mentalRating: report?.mentalRating ?? 0,
        // Overall (average of 3)
        overall: report
          ? parseFloat(
            (
              ((report.technicalRating ?? 0) +
                (report.physicalRating ?? 0) +
                (report.mentalRating ?? 0)) /
              3
            ).toFixed(1)
          )
          : 0,
        // Text fields
        primaryFocus: report?.primaryFocus ?? '',
        technicalWins: report?.technicalWins ?? '',
        progress: report?.progress ?? '',
        intangibles: report?.intangibles ?? '',
        technicalFlaws: report?.technicalFlaws ?? '',
        tacticalMentalAspects: report?.tacticalMentalAspects ?? '',
        specificDrills: report?.specificDrills ?? '',
        fitnessConditioning: report?.fitnessConditioning ?? '',
        goalForNextSession: report?.goalForNextSession ?? '',
        closingEncouragement: report?.closingEncouragement ?? '',
        // Backward compat aliases expected by the Flutter client
        notes: report?.closingEncouragement ?? report?.primaryFocus ?? '',
        coachNotes: report?.primaryFocus ?? '',
        batting: report?.technicalRating ?? 0,
        bowling: report?.physicalRating ?? 0,
        fielding: report?.mentalRating ?? 0,
      });
    }

    return res.status(200).json({
      status: 'success',
      total: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error('Get player reports error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch player reports',
    });
  }
};