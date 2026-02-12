import mongoose from 'mongoose';
import Session from '../../models/Session.js';
import User from '../../models/User.js';

/**
 * GET /api/admin/coaches/:id/sessions
 * Admin-only: Get all sessions for a specific coach with advanced filtering
 *
 * Query params:
 *   - type: all | upcoming | past | completed | cancelled | draft (default: all)
 *   - page: number (default 1)
 *   - limit: number (default 10)
 *   - sort: startTime | -startTime (default -startTime = newest first)
 */
export const getCoachSessionsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type = 'all',
      page = 1,
      limit = 10,
      sort = '-startTime',
    } = req.query;

    // Validate coach ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coach ID format",
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const now = new Date();

    // Base query: sessions for this coach
    const query = { coach: new mongoose.Types.ObjectId(id) };

    // Filter by type
    if (type === 'upcoming') {
      query['timeSlots.startTime'] = { $gt: now };
      query.status = { $nin: ['cancelled', 'completed'] };
    } else if (type === 'past') {
      query.$or = [
        { 'timeSlots.endTime': { $lt: now } },
        { status: 'completed' },
      ];
    } else if (type === 'completed') {
      query.status = 'completed';
    } else if (type === 'cancelled') {
      query.status = 'cancelled';
    } else if (type === 'draft') {
      query.status = 'draft';
    }
    // 'all' → no extra filter

    // Fetch sessions with population
    const sessions = await Session.find(query)
      .sort(sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedPlayers.player', 'fullName email profilePhoto')
      .populate('coach', 'fullName email profilePhoto')
      .lean();

    // Total count for pagination
    const total = await Session.countDocuments(query);

    return res.status(200).json({
      success: true,
      results: sessions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      type,
      data: sessions,
    });
  } catch (error) {
    console.error("Admin get coach sessions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coach sessions",
    });
  }
};

/**
 * GET /api/admin/coaches/:id/sessions/recent
 * Admin-only: Get recent sessions (last 10 upcoming + past) for quick view
 */
export const getCoachRecentSessionsAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coach ID format",
      });
    }

    const now = new Date();

    // Get upcoming (soonest 5)
    const upcoming = await Session.find({
      coach: new mongoose.Types.ObjectId(id),
      status: { $nin: ['cancelled', 'completed'] },
      'timeSlots.startTime': { $gt: now },
    })
      .sort({ 'timeSlots.startTime': 1 })
      .limit(5)
      .populate('assignedPlayers.player', 'fullName email profilePhoto')
      .populate('coach', 'fullName email profilePhoto')
      .lean();

    // Get past/recent completed (most recent 5)
    const past = await Session.find({
      coach: new mongoose.Types.ObjectId(id),
      $or: [
        { 'timeSlots.endTime': { $lt: now } },
        { status: 'completed' },
      ],
    })
      .sort({ 'timeSlots.endTime': -1 })
      .limit(5)
      .populate('assignedPlayers.player', 'fullName email profilePhoto')
      .populate('coach', 'fullName email profilePhoto')
      .lean();

    // Combine (upcoming first, then past)
    const recentSessions = [...upcoming, ...past];

    return res.status(200).json({
      success: true,
      data: recentSessions,
      upcomingCount: upcoming.length,
      pastCount: past.length,
    });
  } catch (error) {
    console.error("Admin get recent coach sessions error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent sessions",
    });
  }
};