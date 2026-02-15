import CoachProfile from "../models/CoachProfile.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import PlayerProfile from "../models/PlayerProfile.js";

export const getCoachProfile = async (req, res) => {
  try {
    const profile = await CoachProfile.findOne({
      userId: req.user.userId,
    });

    if (!profile) {
      return res.status(404).json({
        message: "Coach profile not found",
      });
    }

    return res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCoachProfile = async (req, res) => {
  const updated = await CoachProfile.findOneAndUpdate(
    { userId: req.user.userId },
    req.body,
    { new: true, runValidators: true }
  );

  res.json({
    message: "Coach profile updated",
    profile: updated,
  });
};

/**
 * GET /api/coaches/players
 * Get all players assigned to the coach across all sessions
 */
export const getCoachPlayers = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find all sessions created by this coach
    const sessions = await Session.find({ coach: userId })
      .populate('assignedPlayers.player', 'fullName email phoneNumber')
      .lean();

    // Extract unique players
    const playerMap = new Map();
    let activeCount = 0;
    let needsReviewCount = 0;

    sessions.forEach(session => {
      session.assignedPlayers?.forEach(ap => {
        if (ap.player && ap.player._id) {
          const playerId = ap.player._id.toString();

          if (!playerMap.has(playerId)) {
            playerMap.set(playerId, {
              _id: ap.player._id,
              name: ap.player.fullName,
              email: ap.player.email,
              phone: ap.player.phoneNumber,
              status: ap.status, // invited, confirmed, declined, waitlisted
              avatarUrl: `https://i.pravatar.cc/150?u=${playerId}`,
              sessionsCount: 1,
            });

            // Count statuses
            if (ap.status === 'confirmed') activeCount++;
            if (ap.status === 'invited') needsReviewCount++;
          } else {
            // Increment session count for this player
            const player = playerMap.get(playerId);
            player.sessionsCount++;
          }
        }
      });
    });

    const players = Array.from(playerMap.values());

    return res.status(200).json({
      success: true,
      data: {
        players,
        stats: {
          total: players.length,
          active: activeCount,
          needsReview: needsReviewCount,
        },
      },
    });
  } catch (error) {
    console.error('Get coach players error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch players",
      error: error.message,
    });
  }
};

/**
 * GET /api/coach/availability
 * Get coach's availability settings
 */
export const getCoachAvailability = async (req, res) => {
  try {
    const userId = req.user.userId;

    const profile = await CoachProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    // Initialize availability if it doesn't exist
    if (!profile.availability) {
      profile.availability = {
        recurringSchedule: {
          daySchedules: {
            '0': [{ start: "09:00 AM", end: "05:00 PM" }],
            '1': [{ start: "09:00 AM", end: "05:00 PM" }],
            '2': [{ start: "09:00 AM", end: "05:00 PM" }],
            '3': [{ start: "09:00 AM", end: "05:00 PM" }],
            '4': [{ start: "09:00 AM", end: "05:00 PM" }],
            '5': [],
            '6': [],
          },
        },
        blockedDates: [],
      };
      await profile.save();
    }

    // Ensure nested structures exist
    if (!profile.availability.recurringSchedule) {
      profile.availability.recurringSchedule = {
        daySchedules: {
          '0': [{ start: "09:00 AM", end: "05:00 PM" }],
          '1': [{ start: "09:00 AM", end: "05:00 PM" }],
          '2': [{ start: "09:00 AM", end: "05:00 PM" }],
          '3': [{ start: "09:00 AM", end: "05:00 PM" }],
          '4': [{ start: "09:00 AM", end: "05:00 PM" }],
          '5': [],
          '6': [],
        },
      };
      await profile.save();
    }

    // Initialize daySchedules if it doesn't exist (for backward compatibility)
    if (!profile.availability.recurringSchedule.daySchedules) {
      profile.availability.recurringSchedule.daySchedules = {
        '0': [{ start: "09:00 AM", end: "05:00 PM" }],
        '1': [{ start: "09:00 AM", end: "05:00 PM" }],
        '2': [{ start: "09:00 AM", end: "05:00 PM" }],
        '3': [{ start: "09:00 AM", end: "05:00 PM" }],
        '4': [{ start: "09:00 AM", end: "05:00 PM" }],
        '5': [],
        '6': [],
      };
      await profile.save();
    }

    if (!profile.availability.blockedDates) {
      profile.availability.blockedDates = [];
      await profile.save();
    }

    return res.status(200).json({
      success: true,
      data: profile.availability,
    });
  } catch (error) {
    console.error('Get availability error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch availability",
      error: error.message,
    });
  }
};

/**
 * PUT /api/coach/availability
 * Update coach's availability (recurring schedule and blocked dates)
 */
export const updateCoachAvailability = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { recurringSchedule, blockedDates } = req.body;

    const profile = await CoachProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    // Initialize availability if it doesn't exist
    if (!profile.availability) {
      profile.availability = {
        recurringSchedule: {
          daySchedules: {},
        },
        blockedDates: [],
      };
    }

    // Update availability
    if (recurringSchedule) {
      if (!profile.availability.recurringSchedule) {
        profile.availability.recurringSchedule = {};
      }
      // Support both new daySchedules format and legacy format
      if (recurringSchedule.daySchedules) {
        profile.availability.recurringSchedule.daySchedules = recurringSchedule.daySchedules;
      }
      // Legacy support
      if (recurringSchedule.activeDays) {
        profile.availability.recurringSchedule.activeDays = recurringSchedule.activeDays;
      }
      if (recurringSchedule.timeIntervals) {
        profile.availability.recurringSchedule.timeIntervals = recurringSchedule.timeIntervals;
      }
    }
    if (blockedDates !== undefined) {
      profile.availability.blockedDates = blockedDates;
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      data: profile.availability,
    });
  } catch (error) {
    console.error('Update availability error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to update availability",
      error: error.message,
    });
  }
};

/**
 * POST /api/coach/availability/blocked-date
 * Add a blocked date
 */
export const addBlockedDate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, startDate, endDate, icon, color } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Title, startDate, and endDate are required",
      });
    }

    const profile = await CoachProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    const newBlockedDate = {
      title,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      icon: icon || 'block',
      color: color || 'red',
      createdAt: new Date(),
    };

    profile.availability.blockedDates.push(newBlockedDate);
    await profile.save();

    return res.status(201).json({
      success: true,
      message: "Blocked date added successfully",
      data: newBlockedDate,
    });
  } catch (error) {
    console.error('Add blocked date error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to add blocked date",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/coach/availability/blocked-date/:id
 * Remove a blocked date
 */
export const removeBlockedDate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const profile = await CoachProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    profile.availability.blockedDates = profile.availability.blockedDates.filter(
      (bd) => bd._id.toString() !== id
    );

    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Blocked date removed successfully",
    });
  } catch (error) {
    console.error('Remove blocked date error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove blocked date",
      error: error.message,
    });
  }
};
/**
 * GET /api/coach/settings/session
 * Get coach's session settings (pricing and booking rules)
 */
export const getSessionSettings = async (req, res) => {
  try {
    const userId = req.user.userId;

    const profile = await CoachProfile.findOne({ userId })
      .select('defaultPricing bookingSettings');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        defaultPricing: profile.defaultPricing,
        bookingSettings: profile.bookingSettings,
      },
    });
  } catch (error) {
    console.error('Get session settings error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch session settings",
      error: error.message,
    });
  }
};

/**
 * PUT /api/coach/settings/session
 * Update coach's session settings
 */
export const updateSessionSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { defaultPricing, bookingSettings } = req.body;

    const profile = await CoachProfile.findOne({ userId });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Coach profile not found",
      });
    }

    // Update fields if provided
    if (defaultPricing) {
      // Use spread or explicit assignment to allow partial updates if desired, 
      // but for settings forms usually full object is sent.
      // We'll do a merge to be safe.
      if (defaultPricing.hourlyRate !== undefined) profile.defaultPricing.hourlyRate = defaultPricing.hourlyRate;
      if (defaultPricing.sessionDuration !== undefined) profile.defaultPricing.sessionDuration = defaultPricing.sessionDuration;
      if (defaultPricing.currency !== undefined) profile.defaultPricing.currency = defaultPricing.currency;
    }

    if (bookingSettings) {
      // Initialize if missing (schema update migration)
      if (!profile.bookingSettings) profile.bookingSettings = {};

      if (bookingSettings.bufferTime !== undefined) profile.bookingSettings.bufferTime = bookingSettings.bufferTime;
      if (bookingSettings.minAdvanceBookingHours !== undefined) profile.bookingSettings.minAdvanceBookingHours = bookingSettings.minAdvanceBookingHours;
      if (bookingSettings.maxAdvanceBookingDays !== undefined) profile.bookingSettings.maxAdvanceBookingDays = bookingSettings.maxAdvanceBookingDays;
      if (bookingSettings.cancellationPolicy !== undefined) profile.bookingSettings.cancellationPolicy = bookingSettings.cancellationPolicy;
      if (bookingSettings.autoAccept !== undefined) profile.bookingSettings.autoAccept = bookingSettings.autoAccept;
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Session settings updated successfully",
      data: {
        defaultPricing: profile.defaultPricing,
        bookingSettings: profile.bookingSettings,
      },
    });
  } catch (error) {
    console.error('Update session settings error:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to update session settings",
      error: error.message,
    });
  }
};