// controllers/admin/adminController.js

import mongoose from "mongoose";
import Booking from "../../models/Booking.js";
// import User from "../../models/User.js";
// import Session from "../../models/Session.js";

// ... your existing functions (getAllCoaches, etc.) ...

/**
 * GET /api/admin/bookings
 * Admin-only: Get all bookings with advanced filters & pagination
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 10)
 *   - search: string (player name/email or coach name/email)
 *   - status: pending|confirmed|cancelled|completed|all (default all)
 *   - type: upcoming|past|all (default all)
 *   - startDate: ISO date (bookings >= this date)
 *   - endDate: ISO date (bookings <= this date)
 *   - sort: createdAt|-createdAt|occurrenceDate|-occurrenceDate (default -createdAt)
 */
export const getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      type = "all",
      startDate,
      endDate,
      sort = "-createdAt",
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    const query = {};

    // Status filter
    if (status !== "all") {
      query.status = status;
    }

    // Type filter (upcoming/past)
    if (type === "upcoming") {
      query.occurrenceDate = { $gte: now };
      query.status = { $in: ["pending", "confirmed"] };
    } else if (type === "past") {
      query.$or = [
        { occurrenceDate: { $lt: now } },
        { status: { $in: ["cancelled", "completed"] } },
      ];
    }

    // Date range
    if (startDate || endDate) {
      query.occurrenceDate = query.occurrenceDate || {};
      if (startDate) query.occurrenceDate.$gte = new Date(startDate);
      if (endDate) query.occurrenceDate.$lte = new Date(endDate);
    }

    // Search across player/coach name or email
    if (search) {
      const regex = new RegExp(search.trim(), "i");
      const pipeline = [
        {
          $lookup: {
            from: "users",
            localField: "player",
            foreignField: "_id",
            as: "playerUser",
          },
        },
        { $unwind: { path: "$playerUser", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "sessions",
            localField: "session",
            foreignField: "_id",
            as: "session",
          },
        },
        { $unwind: "$session" },
        {
          $lookup: {
            from: "users",
            localField: "session.coach",
            foreignField: "_id",
            as: "coachUser",
          },
        },
        { $unwind: { path: "$coachUser", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { "playerUser.fullName": regex },
              { "playerUser.email": regex },
              { "coachUser.fullName": regex },
              { "coachUser.email": regex },
            ],
          },
        },
        { $match: query },
        {
          $project: {
            id: "$_id",
            playerName: "$playerUser.fullName",
            playerEmail: "$playerUser.email",
            coachName: "$coachUser.fullName",
            coachEmail: "$coachUser.email",
            sessionTitle: "$session.title",
            occurrenceDate: "$occurrenceDate",
            status: "$status",
            totalAmount: "$pricing.total",
            createdAt: "$createdAt",
          },
        },
        // Sort & paginate
        { $sort: sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 } },
        { $skip: skip },
        { $limit: Number(limit) },
      ];

      const bookings = await Booking.aggregate(pipeline);

      // Total (approximate - no search in count for speed)
      const total = await Booking.countDocuments(query);

      return res.status(200).json({
        success: true,
        data: bookings,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
      });
    }

    // No search → faster query
    const bookings = await Booking.find(query)
      .populate({
        path: "session",
        select: "title coach",
        populate: { path: "coach", select: "fullName email" },
      })
      .populate("player", "fullName email")
      .sort(sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Booking.countDocuments(query);

    const formatted = bookings.map(b => ({
      id: b._id,
      playerName: b.player?.fullName || "Unknown",
      playerEmail: b.player?.email || null,
      coachName: b.session?.coach?.fullName || "Unknown",
      coachEmail: b.session?.coach?.email || null,
      sessionTitle: b.session?.title || "N/A",
      occurrenceDate: b.occurrenceDate,
      status: b.status,
      totalAmount: b.pricing?.total || 0,
      createdAt: b.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin bookings list error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch bookings",
    });
  }
};

/**
 * GET /api/admin/bookings/:id
 * Admin-only: Get full details of a single booking
 */
export const getBookingByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const booking = await Booking.findById(id)
      .populate({
        path: "session",
        select: "title location coach occurrences description",
        populate: { path: "coach", select: "fullName email profilePhoto" },
      })
      .populate("player", "fullName email phoneNumber role")
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Admin get booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking",
    });
  }
};

/**
 * GET /api/admin/bookings/user/:userId
 * Admin-only: Get all bookings for a specific user (player/guardian/coach)
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 10)
 *   - type: upcoming | past | all (default all)
 *   - status: pending | confirmed | cancelled | completed | all (default all)
 *   - sort: createdAt | -createdAt | occurrenceDate | -occurrenceDate (default -occurrenceDate)
 */
export const getUserBookingsAdmin = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const {
      page = 1,
      limit = 10,
      type = "all",
      status = "all",
      sort = "-occurrenceDate",
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    const query = {
      $or: [
        { player: userId },               // user is the player
        { "session.coach": userId },      // user is the coach
      ],
    };

    // Status filter (uses real schema enum)
    if (status !== "all") {
      if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
        });
      }
      query.status = status;
    }

    // Type filter (upcoming/past)
    if (type === "upcoming") {
      query.occurrenceDate = { $gte: now };
      query.status = { $in: ["pending", "confirmed"] };
    } else if (type === "past") {
      query.$or = [
        { occurrenceDate: { $lt: now } },
        { status: { $in: ["cancelled", "completed"] } },
      ];
    }

    const bookings = await Booking.find(query)
      .populate({
        path: "session",
        select: "title location coach occurrences",
        populate: { path: "coach", select: "fullName email" },
      })
      .populate("player", "fullName email")
      .sort(sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Booking.countDocuments(query);

    // Format response to match frontend expectations
    const formattedBookings = bookings.map((booking) => ({
      id: booking._id,
      playerName: booking.player?.fullName || "Unknown",
      playerEmail: booking.player?.email || null,
      coachName: booking.session?.coach?.fullName || "Unknown",
      coachEmail: booking.session?.coach?.email || null,
      sessionTitle: booking.session?.title || "N/A",
      occurrenceDate: booking.occurrenceDate,
      status: booking.status,                    // real status: pending/confirmed/cancelled/completed
      totalAmount: booking.pricing?.total || 0,
      createdAt: booking.createdAt,
      referenceNumber: booking.referenceNumber,  // virtual field
    }));

    return res.status(200).json({
      success: true,
      data: formattedBookings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin user bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user bookings",
    });
  }
};

/**
 * GET /api/admin/bookings/stats
 * Admin-only: Get quick booking statistics for the admin bookings page
 *
 * Returns:
 * - totalBookings: total number of bookings ever
 * - completedBookings: number of 'completed' bookings
 * - pendingBookings: number of 'pending' bookings
 * - (you can easily add more: confirmed, cancelled, totalRevenue, etc.)
 */
export const getBookingStats = async (req, res) => {
  try {
    // Use aggregation for efficiency (single DB call)
    const stats = await Booking.aggregate([
      {
        $facet: {
          totalBookings: [
            { $count: "count" },
          ],
          completedBookings: [
            { $match: { status: "completed" } },
            { $count: "count" },
          ],
          pendingBookings: [
            { $match: { status: "pending" } },
            { $count: "count" },
          ],
          // Optional: add more stats here if needed
          confirmedBookings: [
            { $match: { status: "confirmed" } },
            { $count: "count" },
          ],
          cancelledBookings: [
            { $match: { status: "cancelled" } },
            { $count: "count" },
          ],
          // Example: total revenue (if you want to show later)
          totalRevenue: [
            { $match: { status: { $in: ["completed", "confirmed"] } } },
            { $group: { _id: null, total: { $sum: "$pricing.total" } } },
          ],
        },
      },
    ]);

    // Extract values (safe handling if no data)
    const result = stats[0] || {};

    const response = {
      totalBookings: result.totalBookings?.[0]?.count || 0,
      completedBookings: result.completedBookings?.[0]?.count || 0,
      pendingBookings: result.pendingBookings?.[0]?.count || 0,
      // Optional extras (uncomment when you want them)
      // confirmedBookings: result.confirmedBookings?.[0]?.count || 0,
      // cancelledBookings: result.cancelledBookings?.[0]?.count || 0,
      // totalRevenue: result.totalRevenue?.[0]?.total || 0,
    };

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Admin booking stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking statistics",
    });
  }
};