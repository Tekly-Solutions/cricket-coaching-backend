import mongoose from "mongoose";
import Booking from "../../models/Booking.js";
import GuardianProfile from "../../models/GuardianProfile.js";
import PlayerProfile from "../../models/PlayerProfile.js";

/**
 * GET /api/admin/guardians/:id/bookings
 * Admin-only: Get all bookings for a guardian's players
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 10)
 *   - type: upcoming | past | all (default all)
 *   - status: pending | confirmed | cancelled | completed | all (default all)
 *   - sort: occurrenceDate | -occurrenceDate | createdAt | -createdAt (default -occurrenceDate)
 */
export const getGuardianBookings = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid guardian ID",
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

    // Get guardian's players
    const guardianProfile = await GuardianProfile.findOne({ userId: id }).lean();

    if (!guardianProfile) {
      return res.status(404).json({
        success: false,
        message: "Guardian profile not found",
      });
    }

    // Get player IDs from guardian profile
    const playerProfileIds = guardianProfile.players || [];

    if (playerProfileIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: Number(page),
          limit: Number(limit),
          pages: 0,
        },
      });
    }

    // Fetch PlayerProfiles to get userId
    const playerProfiles = await PlayerProfile.find({
      _id: { $in: playerProfileIds },
      userId: { $exists: true, $ne: null },
    }).select('userId').lean();

    const playerUserIds = playerProfiles.map(p => p.userId);

    if (playerUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: Number(page),
          limit: Number(limit),
          pages: 0,
        },
      });
    }

    // Build query
    const query = {
      player: { $in: playerUserIds },
    };

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

    // Fetch bookings
    const bookings = await Booking.find(query)
      .populate({
        path: "session",
        select: "title location coach",
        populate: { path: "coach", select: "fullName email" },
      })
      .populate("player", "fullName email")
      .sort(sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Booking.countDocuments(query);

    // Format response
    const formattedBookings = bookings.map((booking) => ({
      id: booking._id,
      playerName: booking.player?.fullName || "Unknown",
      playerEmail: booking.player?.email || null,
      coachName: booking.session?.coach?.fullName || "Unknown",
      sessionTitle: booking.session?.title || "N/A",
      location: booking.session?.location || "N/A",
      occurrenceDate: booking.occurrenceDate,
      status: booking.status,
      totalAmount: booking.pricing?.total || 0,
      createdAt: booking.createdAt,
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
    console.error("Admin guardian bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch guardian bookings",
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/guardians/:id/bookings/recent
 * Admin-only: Get recent bookings for a guardian (last 5 upcoming + 5 past)
 */
export const getGuardianRecentBookings = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid guardian ID",
      });
    }

    const now = new Date();

    // Get guardian's players
    const guardianProfile = await GuardianProfile.findOne({ userId: id }).lean();

    if (!guardianProfile) {
      return res.status(404).json({
        success: false,
        message: "Guardian profile not found",
      });
    }

    // Get player IDs from guardian profile
    const playerProfileIds = guardianProfile.players || [];

    if (playerProfileIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Fetch PlayerProfiles to get userId
    const playerProfiles = await PlayerProfile.find({
      _id: { $in: playerProfileIds },
      userId: { $exists: true, $ne: null }, // Only self-managed players
    }).select('userId').lean();

    const playerUserIds = playerProfiles.map(p => p.userId);

    if (playerUserIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Get upcoming (next 5)
    const upcoming = await Booking.find({
      player: { $in: playerUserIds },
      occurrenceDate: { $gte: now },
      status: { $in: ["pending", "confirmed"] },
    })
      .populate({
        path: "session",
        select: "title location coach",
        populate: { path: "coach", select: "fullName email" },
      })
      .populate("player", "fullName email")
      .sort({ occurrenceDate: 1 })
      .limit(5)
      .lean();

    // Get past (most recent 5)
    const past = await Booking.find({
      player: { $in: playerUserIds },
      $or: [
        { occurrenceDate: { $lt: now } },
        { status: { $in: ["cancelled", "completed"] } },
      ],
    })
      .populate({
        path: "session",
        select: "title location coach",
        populate: { path: "coach", select: "fullName email" },
      })
      .populate("player", "fullName email")
      .sort({ occurrenceDate: -1 })
      .limit(5)
      .lean();

    // Combine and format
    const allBookings = [...upcoming, ...past];
    const formattedBookings = allBookings.map((booking) => ({
      id: booking._id,
      playerName: booking.player?.fullName || "Unknown",
      coachName: booking.session?.coach?.fullName || "Unknown",
      sessionTitle: booking.session?.title || "N/A",
      location: booking.session?.location || "N/A",
      occurrenceDate: booking.occurrenceDate,
      status: booking.status,
      totalAmount: booking.pricing?.total || 0,
    }));

    return res.status(200).json({
      success: true,
      data: formattedBookings,
    });
  } catch (error) {
    console.error("Admin guardian recent bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent bookings",
      error: error.message, // Add this for debugging
    });
  }
};