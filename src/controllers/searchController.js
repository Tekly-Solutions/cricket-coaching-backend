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
      page = 1,
      limit = 10,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchQuery = {
      status: 'published', // Only show published sessions
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

    // Search coaches (limited results)
    const coaches = await CoachProfile.find({
      $or: [
        { specializations: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ]
    })
      .populate('userId', 'fullName email profilePhoto')
      .sort({ 'rating': -1 })
      .limit(parseInt(limit))
      .lean();

    // Search sessions (limited results)
    const now = new Date();
    const sessions = await Session.find({
      status: 'published',
      'timeSlots.startTime': { $gte: now },
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    })
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
