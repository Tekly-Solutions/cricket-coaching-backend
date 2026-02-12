import Earning from '../models/Earning.js';
import Session from '../models/Session.js';
import Booking from '../models/Booking.js';

/**
 * Get coach's total earnings
 * GET /api/earnings/total
 */
export const getTotalEarnings = async (req, res) => {
  try {
    const coachId = req.user.userId;

    const result = await Earning.getTotalEarnings(coachId, ['confirmed', 'paid']);

    // Calculate percentage change from last period (month)
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const lastMonth = await Earning.aggregate([
      {
        $match: {
          coach: req.user._id,
          status: { $in: ['confirmed', 'paid'] },
          sessionDate: {
            $gte: lastMonthStart,
            $lte: lastMonthEnd,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$netAmount' },
        },
      },
    ]);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonth = await Earning.aggregate([
      {
        $match: {
          coach: req.user._id,
          status: { $in: ['confirmed', 'paid'] },
          sessionDate: {
            $gte: currentMonthStart,
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$netAmount' },
        },
      },
    ]);

    const lastMonthTotal = lastMonth[0]?.total || 0;
    const currentMonthTotal = currentMonth[0]?.total || 0;

    let percentageChange = 0;
    let changeAmount = 0;

    if (lastMonthTotal > 0) {
      changeAmount = currentMonthTotal - lastMonthTotal;
      percentageChange = ((changeAmount / lastMonthTotal) * 100).toFixed(1);
    }

    res.json({
      success: true,
      data: {
        totalBalance: result.total || 0,
        totalSessions: result.count || 0,
        percentageChange: parseFloat(percentageChange),
        changeAmount: changeAmount,
        currency: 'USD',
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get total earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch total earnings',
      error: error.message,
    });
  }
};

/**
 * Get earnings by period (weekly, monthly, yearly)
 * GET /api/earnings/period?type=monthly&startDate=2024-01-01&endDate=2024-12-31
 */
export const getEarningsByPeriod = async (req, res) => {
  try {
    const coachId = req.user.userId;
    const { type = 'monthly', startDate, endDate } = req.query;

    // Default date ranges if not provided
    const now = new Date();
    let start, end, groupBy;

    if (type === 'weekly') {
      // Last 4 weeks
      start = new Date(now);
      start.setDate(now.getDate() - 28);
      end = now;
      groupBy = 'week';
    } else if (type === 'yearly') {
      // Last 4 years
      start = new Date(now.getFullYear() - 3, 0, 1);
      end = now;
      groupBy = 'year';
    } else {
      // Monthly (default) - Last 4 months
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = now;
      groupBy = 'month';
    }

    // Use provided dates if available
    if (startDate) start = new Date(startDate);
    if (endDate) end = new Date(endDate);

    const earnings = await Earning.getEarningsByPeriod(
      coachId,
      start,
      end,
      groupBy
    );

    res.json({
      success: true,
      data: {
        period: type,
        startDate: start,
        endDate: end,
        earnings: earnings,
        currency: 'USD',
      },
    });
  } catch (error) {
    console.error('Get earnings by period error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings by period',
      error: error.message,
    });
  }
};

/**
 * Get earnings history/transactions
 * GET /api/earnings/history?page=1&limit=20&status=confirmed
 */
export const getEarningsHistory = async (req, res) => {
  try {
    const coachId = req.user.userId;
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
    } = req.query;

    const query = { coach: coachId };

    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['confirmed', 'paid'] };
    }

    if (startDate || endDate) {
      query.sessionDate = {};
      if (startDate) query.sessionDate.$gte = new Date(startDate);
      if (endDate) query.sessionDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [earnings, total] = await Promise.all([
      Earning.find(query)
        .populate('player', 'fullName profilePhoto') // PlayerProfile fields
        .populate('session', 'title')
        .sort({ sessionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Earning.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        earnings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get earnings history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings history',
      error: error.message,
    });
  }
};

/**
 * Get earnings summary/stats
 * GET /api/earnings/summary
 */
export const getEarningsSummary = async (req, res) => {
  try {
    const coachId = req.user.userId;
    const now = new Date();

    // Current month
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [totalEarnings, currentMonthEarnings, lastMonthEarnings, recentEarnings] = await Promise.all([
      Earning.getTotalEarnings(coachId, ['confirmed', 'paid']),

      Earning.aggregate([
        {
          $match: {
            coach: coachId,
            status: { $in: ['confirmed', 'paid'] },
            sessionDate: { $gte: currentMonthStart },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$netAmount' },
            count: { $sum: 1 },
          },
        },
      ]),

      Earning.aggregate([
        {
          $match: {
            coach: coachId,
            status: { $in: ['confirmed', 'paid'] },
            sessionDate: {
              $gte: lastMonthStart,
              $lte: lastMonthEnd,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$netAmount' },
            count: { $sum: 1 },
          },
        },
      ]),

      Earning.find({
        coach: coachId,
        status: { $in: ['confirmed', 'paid', 'pending'] },
      })
        .populate('player', 'fullName profilePhoto') // PlayerProfile fields
        .sort({ sessionDate: -1 })
        .limit(10)
        .lean(),
    ]);

    const currentTotal = currentMonthEarnings[0]?.total || 0;
    const lastTotal = lastMonthEarnings[0]?.total || 0;
    const changeAmount = currentTotal - lastTotal;
    const percentageChange = lastTotal > 0 ? ((changeAmount / lastTotal) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        totalBalance: totalEarnings.total || 0,
        totalSessions: totalEarnings.count || 0,
        currentMonth: {
          total: currentTotal,
          count: currentMonthEarnings[0]?.count || 0,
        },
        lastMonth: {
          total: lastTotal,
          count: lastMonthEarnings[0]?.count || 0,
        },
        trend: {
          changeAmount,
          percentageChange: parseFloat(percentageChange),
        },
        recentActivity: recentEarnings,
        currency: 'USD',
      },
    });
  } catch (error) {
    console.error('Get earnings summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings summary',
      error: error.message,
    });
  }
};

/**
 * Create earning record (internal use - called when session is completed)
 * POST /api/earnings
 */
export const createEarning = async (req, res) => {
  try {
    const {
      sessionId,
      bookingId,
      playerId,
      amount,
      sessionTitle,
      sessionDate,
      sessionType,
    } = req.body;

    const earning = await Earning.create({
      coach: req.user.userId,
      session: sessionId,
      booking: bookingId,
      player: playerId,
      amount,
      sessionTitle,
      sessionDate,
      sessionType: sessionType || 'one-on-one',
      status: 'confirmed',
      currency: 'USD',
      platformFee: 0, // MVP: no platform fee
    });

    res.status(201).json({
      success: true,
      data: earning,
    });
  } catch (error) {
    console.error('Create earning error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create earning record',
      error: error.message,
    });
  }
};

/**
 * Request cash out (MVP: placeholder)
 * POST /api/earnings/cashout
 */
export const requestCashOut = async (req, res) => {
  try {
    const coachId = req.user.userId;
    const { amount } = req.body;

    // MVP: Just return success message
    // Future: Implement actual payout integration

    res.json({
      success: true,
      message: 'Cash out feature coming soon! We will notify you when this feature is available.',
      data: {
        requestedAmount: amount,
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('Cash out request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process cash out request',
      error: error.message,
    });
  }
};
