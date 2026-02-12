// controllers/searchController.js
import CoachProfile from '../models/CoachProfile.js';
import Session from '../models/Session.js';
import User from '../models/User.js';

/**
 * GET /api/search/coaches
 * Search for coaches with filters
 * Query params:
 *   - query: search term (name, specialization)
 *   - specialization: filter by specialization
 *   - minRating: minimum rating
 *   - location: location filter
 *   - page: pagination page (default 1)
 *   - limit: results per page (default 10)
 */
export const searchCoaches = async (req, res) => {
  try {
    const {
      query = '',
      specialization,
      minRating,
      location,
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchQuery = {};

    // Build search query
    if (query.trim()) {
      // Find users whose names match the query
      const users = await User.find({
        role: 'coach',
        fullName: { $regex: query, $options: 'i' }
      }).select('_id');

      const userIds = users.map(u => u._id);

      // Search in coach profiles by userId or specializations
      searchQuery.$or = [
        { userId: { $in: userIds } },
        { specializations: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ];
    }

    // Filter by specialization
    if (specialization) {
      searchQuery.specializations = { $regex: specialization, $options: 'i' };
    }

    // Filter by minimum rating
    if (minRating) {
      searchQuery['rating'] = { $gte: parseFloat(minRating) };
    }

    // Filter by location (you can enhance this with geocoding)
    if (location) {
      searchQuery.location = { $regex: location, $options: 'i' };
    }

    // Fetch coaches
    const coaches = await CoachProfile.find(searchQuery)
      .populate('userId', 'fullName email profilePhoto')
      .sort({ 'rating': -1 }) // Sort by rating descending
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Total count for pagination
    const total = await CoachProfile.countDocuments(searchQuery);

    return res.status(200).json({
      status: 'success',
      results: coaches.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: coaches,
    });
  } catch (error) {
    console.error('Search coaches error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to search coaches',
    });
  }
};

/**
 * GET /api/search/sessions
 * Search for available sessions
 * Query params:
 *   - query: search term (title, description)
 *   - location: location filter
 *   - startDate: filter sessions starting after this date
 *   - endDate: filter sessions before this date
 *   - page: pagination page (default 1)
 *   - limit: results per page (default 10)
 */
export const searchSessions = async (req, res) => {
  try {
    const {
      query = '',
      location,
      startDate,
      endDate,
      coachId, // Filter by specific coach (User ID)
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchQuery = {
      status: 'published', // Only show published sessions
      title: { $ne: '1-on-1 Session' }, // Exclude private sessions
    };

    // Search by title or description
    if (query.trim()) {
      searchQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }

    // Filter by location
    if (location) {
      searchQuery.location = { $regex: location, $options: 'i' };
    }

    // Filter by coach (User ID)
    if (coachId) {
      searchQuery.coach = coachId;
    }

    // Filter by date range
    const now = new Date();
    if (startDate || endDate) {
      searchQuery['timeSlots.startTime'] = {};
      if (startDate) {
        searchQuery['timeSlots.startTime'].$gte = new Date(startDate);
      } else {
        // Default: only show future sessions
        searchQuery['timeSlots.startTime'].$gte = now;
      }
      if (endDate) {
        searchQuery['timeSlots.startTime'].$lte = new Date(endDate);
      }
    } else {
      // Default: only show upcoming sessions
      searchQuery['timeSlots.startTime'] = { $gte: now };
    }

    // Only show sessions with available capacity
    searchQuery.$expr = { $lt: ['$assignedPlayers', '$capacity'] };

    // Fetch sessions
    const sessions = await Session.find(searchQuery)
      .populate('coach', 'fullName profilePhoto email')
      .sort({ 'timeSlots.startTime': 1 }) // Sort by start time ascending
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Total count for pagination
    const total = await Session.countDocuments(searchQuery);

    return res.status(200).json({
      status: 'success',
      results: sessions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: sessions,
    });
  } catch (error) {
    console.error('Search sessions error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to search sessions',
    });
  }
};

/**
 * GET /api/search/all
 * Search both coaches and sessions
 */
export const searchAll = async (req, res) => {
  try {
    const { query = '', limit = 5 } = req.query;

    // 1. Search Coaches
    let coachQuery = {};
    if (query.trim()) {
      // Find users matching name
      const users = await User.find({
        role: 'coach',
        fullName: { $regex: query, $options: 'i' }
      }).select('_id');

      const userIds = users.map(u => u._id);

      coachQuery.$or = [
        { userId: { $in: userIds } },
        { specializations: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ];
    }

    const coaches = await CoachProfile.find(coachQuery)
      .populate('userId', 'fullName email profilePhoto')
      .sort({ 'rating': -1 })
      .limit(parseInt(limit))
      .lean();

    // 2. Search Sessions
    const now = new Date();
    let sessionQuery = {
      status: 'published',
      title: { $ne: '1-on-1 Session' },
      'timeSlots.startTime': { $gte: now },
    };

    if (query.trim()) {
      sessionQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }

    const sessions = await Session.find(sessionQuery)
      .populate('coach', 'fullName profilePhoto email')
      .sort({ 'timeSlots.startTime': 1 })
      .limit(parseInt(limit))
      .lean();

    return res.status(200).json({
      status: 'success',
      data: {
        coaches: coaches,
        sessions: sessions,
      },
      results: {
        coaches: coaches.length,
        sessions: sessions.length
      }
    });
  } catch (error) {
    console.error('Search all error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to search',
    });
  }
};

/**
 * GET /api/search/coaches/:id
 * Get detailed coach profile by ID
 */
export const getCoachDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Find coach profile by CoachProfile ID or User ID?
    // The route is /search/coaches/:id.
    // Frontend passes `widget.coachId`. Let's assume it's the CoachProfile _id.
    // However, it's safer to check if it's a valid ObjectId.

    let coach = await CoachProfile.findById(id)
      .populate('userId', 'fullName email profilePhoto phoneNumber') // Fetch user details
      .lean();

    // If not found by Profile ID, try finding by User ID
    if (!coach) {
      coach = await CoachProfile.findOne({ userId: id })
        .populate('userId', 'fullName email profilePhoto phoneNumber')
        .lean();
    }

    if (!coach) {
      return res.status(404).json({
        status: 'error',
        message: 'Coach not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: coach,
    });
  } catch (error) {
    console.error('Get coach details error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get coach details',
    });
  }
};

/**
 * GET /api/search/coaches/:id/availability
 * Get available time slots for a coach
 * Query params:
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 */
export const getCoachAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'Start date and end date are required',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // 1. Fetch Coach Profile (try User ID first as that's what we usually pass, then Profile ID)
    let coach = await CoachProfile.findOne({ userId: id });
    if (!coach) {
      coach = await CoachProfile.findById(id);
    }

    if (!coach) {
      // If passing userId and no profile, maybe it's just a user? But we need profile for schedule.
      return res.status(404).json({
        status: 'error',
        message: 'Coach profile not found',
      });
    }

    // 2. Fetch Existing Sessions (Group & Private)
    const existingSessions = await Session.find({
      coach: coach.userId, // Sessions are linked to User ID
      status: { $in: ['published', 'draft'] }, // Include draft to be safe? usually only published.
      'timeSlots.startTime': { $gte: start, $lte: end },
    }).select('timeSlots durationMinutes');

    // 3. Generate Available Slots
    const availability = [];

    // Safety check for availability object
    const recurringSchedule = coach.availability && coach.availability.recurringSchedule;
    const daySchedules = recurringSchedule ? recurringSchedule.daySchedules : null;
    const blockedDates = (coach.availability && coach.availability.blockedDates) || [];

    if (!daySchedules) {
      return res.status(200).json({ status: 'success', data: [] });
    }

    // Loop through each day in range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday...
      // Map JS day to Profile day: 0=Monday, ... 6=Sunday.
      const profileDayIndex = (dayOfWeek + 6) % 7;

      // Since daySchedules is a Map in Mongoose, use .get()
      const schedules = daySchedules.get(profileDayIndex.toString());

      if (!schedules || schedules.length === 0) continue;

      // Check if Date is Blocked
      const isBlocked = blockedDates.some(bd => {
        const blockStart = new Date(bd.startDate);
        const blockEnd = new Date(bd.endDate);
        // Check if 'd' is within block range
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
        return (blockStart <= dayEnd && blockEnd >= dayStart);
      });

      if (isBlocked) continue;

      // Generate slots for this day
      for (const schedule of schedules) {
        // Parse "09:00 AM" to Date object for this day
        const slotStart = parseTime(d, schedule.start);
        const slotEnd = parseTime(d, schedule.end);

        // Break into hourly slots (or sessionDuration)
        const sessionDuration = coach.defaultPricing?.sessionDuration || 60;

        let currentSlot = new Date(slotStart);
        // Loop while session fits
        while (currentSlot.getTime() + sessionDuration * 60000 <= slotEnd.getTime()) {
          const nextSlot = new Date(currentSlot.getTime() + sessionDuration * 60000);

          // Check overlap with existing sessions
          const isBooked = existingSessions.some(session => {
            return session.timeSlots.some(ts => {
              const sStart = new Date(ts.startTime);
              const sEnd = new Date(ts.endTime);
              // Overlap logic: (StartA < EndB) and (EndA > StartB)
              return (currentSlot < sEnd && nextSlot > sStart);
            });
          });

          if (!isBooked) {
            availability.push({
              startTime: currentSlot.toISOString(),
              endTime: nextSlot.toISOString(),
              isAvailable: true,
            });
          }

          // Increment by session duration (or interval? let's assume contiguous blocks)
          currentSlot = nextSlot;
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      data: availability,
    });

  } catch (error) {
    console.error('Get availability error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get availability',
    });
  }
};

// Helper: Parse "09:00 AM" to Date
function parseTime(date, timeStr) {
  const d = new Date(date);
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':');

  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = (parseInt(hours, 10) + 12).toString();
  }

  d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  return d;
}