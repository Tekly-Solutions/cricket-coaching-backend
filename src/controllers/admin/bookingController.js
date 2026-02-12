// controllers/admin/bookingController.js

import mongoose from "mongoose";
import Booking from "../../models/Booking.js";

/**
 * GET /api/admin/bookings/stats
 * Admin-only: Get booking statistics for the admin dashboard
 */
export const getBookingStats = async (req, res) => {
  try {
    // Total bookings
    const totalBookings = await Booking.countDocuments();

    // Completed bookings
    const completedBookings = await Booking.countDocuments({
      status: "completed",
    });

    // Pending bookings
    const pendingBookings = await Booking.countDocuments({
      status: "pending",
    });

    // Calculate total revenue (sum of all completed bookings)
    const revenueResult = await Booking.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$pricing.total" },
        },
      },
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Calculate revenue growth (comparing this month vs last month)
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthRevenue = await Booking.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: startOfThisMonth },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$pricing.total" },
        },
      },
    ]);

    const lastMonthRevenue = await Booking.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$pricing.total" },
        },
      },
    ]);

    const thisMonth = thisMonthRevenue.length > 0 ? thisMonthRevenue[0].revenue : 0;
    const lastMonth = lastMonthRevenue.length > 0 ? lastMonthRevenue[0].revenue : 0;

    let revenueGrowth = 0;
    if (lastMonth > 0) {
      revenueGrowth = ((thisMonth - lastMonth) / lastMonth) * 100;
    } else if (thisMonth > 0) {
      revenueGrowth = 100;
    }

    return res.status(200).json({
      success: true,
      data: {
        totalBookings,
        completedBookings,
        pendingBookings,
        totalRevenue: Math.round(totalRevenue),
        revenueGrowth: parseFloat(revenueGrowth.toFixed(1)),
      },
    });
  } catch (error) {
    console.error("Admin booking stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking statistics",
    });
  }
};

/**
 * GET /api/admin/bookings
 * Admin-only: Get all bookings with advanced filters & pagination
 */
export const getAllBookings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      sport = "all",
      type = "all",
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    // Build base query
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

    // Date range filter
    if (startDate || endDate) {
      query.occurrenceDate = query.occurrenceDate || {};
      if (startDate) query.occurrenceDate.$gte = new Date(startDate);
      if (endDate) query.occurrenceDate.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Get bookings with population
    let bookingsQuery = Booking.find(query)
      .populate({
        path: "session",
        select: "title location coach sport occurrences",
        populate: { path: "coach", select: "fullName email coachProfile" },
      })
      .populate("player", "fullName email")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const bookings = await bookingsQuery;

    // Get total count for pagination
    const total = await Booking.countDocuments(query);

    // Apply search and sport filters after population
    let filteredBookings = bookings;

    // Search filter (applied after population)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredBookings = filteredBookings.filter((booking) => {
        const playerName = booking.player?.fullName?.toLowerCase() || "";
        const playerEmail = booking.player?.email?.toLowerCase() || "";
        const coachName = booking.session?.coach?.fullName?.toLowerCase() || "";
        const bookingRef = booking.referenceNumber?.toLowerCase() || "";

        return (
          playerName.includes(searchLower) ||
          playerEmail.includes(searchLower) ||
          coachName.includes(searchLower) ||
          bookingRef.includes(searchLower)
        );
      });
    }

    // Sport filter (applied after population)
    if (sport && sport !== "all") {
      filteredBookings = filteredBookings.filter(
        (booking) => booking.session?.sport === sport
      );
    }

    // Format response
    const formattedBookings = filteredBookings.map((booking) => ({
      id: booking._id,
      bookingId: booking.referenceNumber,
      dateTime: {
        date: new Date(booking.occurrenceDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time: new Date(booking.occurrenceDate).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      parent: {
        name: booking.player?.fullName || "Unknown",
        email: booking.player?.email || "",
      },
      coach: {
        name: booking.session?.coach?.fullName || "Unknown",
        level: booking.session?.coach?.coachProfile?.bio || "Coach",
      },
      sport: booking.session?.sport || "Unknown",
      price: booking.pricing?.sessionFee || 0,
      commission: booking.pricing?.serviceFee || 0,
      total: booking.pricing?.total || 0,
      status: booking.status,
      occurrenceDate: booking.occurrenceDate,
      createdAt: booking.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: formattedBookings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Admin get all bookings error:", error);
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
        select: "title location coach occurrences description sport sessionType",
        populate: { path: "coach", select: "fullName email phone coachProfile" },
      })
      .populate("player", "fullName email phone role")
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Format response
    const formattedBooking = {
      id: booking._id,
      bookingId: booking.referenceNumber,
      status: booking.status,
      occurrenceDate: booking.occurrenceDate,
      createdAt: booking.createdAt,
      paymentMethod: booking.paymentMethod,
      promoCode: booking.promoCode,
      cancelledAt: booking.cancelledAt,
      cancelReason: booking.cancelReason,
      pricing: booking.pricing,
      player: {
        id: booking.player?._id,
        name: booking.player?.fullName,
        email: booking.player?.email,
        phone: booking.player?.phone,
      },
      session: {
        id: booking.session?._id,
        title: booking.session?.title,
        description: booking.session?.description,
        sport: booking.session?.sport,
        location: booking.session?.location,
        sessionType: booking.session?.sessionType,
      },
      coach: {
        id: booking.session?.coach?._id,
        name: booking.session?.coach?.fullName,
        email: booking.session?.coach?.email,
        phone: booking.session?.coach?.phone,
        bio: booking.session?.coach?.coachProfile?.bio,
      },
    };

    return res.status(200).json({
      success: true,
      data: formattedBooking,
    });
  } catch (error) {
    console.error("Admin get booking by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking details",
    });
  }
};

/**
 * GET /api/admin/bookings/user/:userId
 * Admin-only: Get all bookings for a specific user (player or guardian)
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

    // Build query
    const query = { player: userId };

    // Status filter
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
        select: "title location coach sport",
        populate: { path: "coach", select: "fullName" },
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
      bookingId: booking.referenceNumber,
      dateTime: {
        date: new Date(booking.occurrenceDate).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        time: new Date(booking.occurrenceDate).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      parent: {
        name: booking.player?.fullName || "Unknown",
        email: booking.player?.email || "",
      },
      coach: {
        name: booking.session?.coach?.fullName || "Unknown",
      },
      sport: booking.session?.sport || "Unknown",
      price: booking.pricing?.sessionFee || 0,
      commission: booking.pricing?.serviceFee || 0,
      total: booking.pricing?.total || 0,
      status: booking.status,
    }));

    return res.status(200).json({
      success: true,
      data: formattedBookings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("Admin get user bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user bookings",
    });
  }
};

/**
 * PATCH /api/admin/bookings/:id/status
 * Admin-only: Update booking status
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancelReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    if (!["pending", "confirmed", "cancelled", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be pending, confirmed, cancelled, or completed",
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    booking.status = status;

    if (status === "cancelled") {
      booking.cancelledAt = new Date();
      booking.cancelReason = cancelReason || "Cancelled by admin";
    }

    await booking.save();

    return res.status(200).json({
      success: true,
      data: booking,
      message: `Booking status updated to ${status}`,
    });
  } catch (error) {
    console.error("Admin update booking status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update booking status",
    });
  }
};

/**
 * DELETE /api/admin/bookings/:id
 * Admin-only: Delete a booking (only cancelled bookings)
 */
export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Only allow deletion of cancelled bookings
    if (booking.status !== "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Only cancelled bookings can be deleted. Please cancel the booking first.",
      });
    }

    await booking.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete booking",
    });
  }
};