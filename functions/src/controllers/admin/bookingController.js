// controllers/admin/bookingController.js

import mongoose from "mongoose";
import Booking from "../../models/Booking.js";

/**
 * GET /api/admin/bookings/stats
 * Admin-only: Get booking statistics for the admin dashboard
 * MVP rule: confirmed = completed
 */
export const getBookingStats = async (req, res) => {
  try {
    console.log("📊 Fetching booking stats...");

    const totalBookings = await Booking.countDocuments();

    // ✅ MVP: confirmed is considered completed
    const completedBookings = await Booking.countDocuments({
      status: { $in: ["completed", "confirmed"] },
    });

    const pendingBookings = await Booking.countDocuments({ status: "pending" });

    // ✅ Revenue from "done" bookings (completed + confirmed)
    const doneBookingsWithPricing = await Booking.find({
      status: { $in: ["completed", "confirmed"] },
    }).select("pricing");

    const totalRevenue = doneBookingsWithPricing.reduce((sum, booking) => {
      return sum + (booking.pricing?.total || 0);
    }, 0);

    // Revenue growth month-over-month (also using done bookings)
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const thisMonthBookings = await Booking.find({
      status: { $in: ["completed", "confirmed"] },
      createdAt: { $gte: startOfThisMonth },
    }).select("pricing");

    const lastMonthBookings = await Booking.find({
      status: { $in: ["completed", "confirmed"] },
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    }).select("pricing");

    const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0);
    const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

    let revenueGrowth = 0;
    if (lastMonthRevenue > 0) revenueGrowth = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    else if (thisMonthRevenue > 0) revenueGrowth = 100;

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
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/bookings
 * Admin-only: Get all bookings with filters & pagination
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

    const query = {};

    // Status filter
    if (status !== "all") {
      query.status = status;
    }

    // Type filter
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

    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // ✅ IMPORTANT FIX:
    // Booking.player is a PlayerProfile in your detail endpoint.
    // So the list endpoint must populate exactly the same way.
    const bookings = await Booking.find(query)
      .populate({
        path: "player", // PlayerProfile
        select: "fullName profilePhoto guardianId userId", // fields on PlayerProfile
        populate: {
          path: "userId", // User
          select: "fullName email phoneNumber role",
        },
      })
      .populate({
        path: "session",
        select: "title location coach sport occurrences",
        populate: {
          path: "coach",
          select: "fullName email coachProfile",
          populate: {
            path: "coachProfile",
            select: "bio",
          },
        },
      })
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Booking.countDocuments(query);

    // Apply search after population
    let filteredBookings = bookings;

    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredBookings = filteredBookings.filter((booking) => {
        const playerProfile = booking.player || null;
        const playerUser = playerProfile?.userId || null;

        const playerName = (playerUser?.fullName || playerProfile?.fullName || "").toLowerCase();
        const playerEmail = (playerUser?.email || "").toLowerCase();
        const coachName = (booking.session?.coach?.fullName || "").toLowerCase();
        const bookingRef = (booking.referenceNumber || "").toLowerCase();

        return (
          playerName.includes(searchLower) ||
          playerEmail.includes(searchLower) ||
          coachName.includes(searchLower) ||
          bookingRef.includes(searchLower)
        );
      });
    }

    // Sport filter
    if (sport && sport !== "all") {
      filteredBookings = filteredBookings.filter((booking) => booking.session?.sport === sport);
    }

    const formattedBookings = filteredBookings.map((booking) => {
      const playerProfile = booking.player || null;
      const playerUser = playerProfile?.userId || null;

      const playerName = playerUser?.fullName || playerProfile?.fullName || "Unknown";
      const playerEmail = playerUser?.email || "";
      const playerPhone = playerUser?.phoneNumber || "";
      const playerRole = playerUser?.role || "player";

      // guardian managed?
      const guardianManaged = !!playerProfile?.guardianId;

      const sessionData = booking.session || {};
      const coachData = sessionData.coach || {};
      const coachProfileData = coachData.coachProfile || {};

      return {
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
        player: {
          name: playerName,
          email: playerEmail,
          phone: playerPhone,
          role: playerRole,
          guardianManaged,
          profilePhoto: playerProfile?.profilePhoto || null,
        },
        coach: {
          name: coachData.fullName || "Unknown",
          level: coachProfileData.bio || "Coach",
        },
        sport: sessionData.sport || "Unknown",
        price: booking.pricing?.sessionFee || 0,
        commission: booking.pricing?.serviceFee || 0,
        total: booking.pricing?.total || 0,
        status: booking.status,
        occurrenceDate: booking.occurrenceDate,
        createdAt: booking.createdAt,
      };
    });

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
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/bookings/:id
 * (keep your existing working one)
 */
export const getBookingByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id)
      .populate({
        path: "player",
        select: "fullName profilePhoto guardianId userId",
        populate: { path: "userId", select: "fullName email phoneNumber role" },
      })
      .populate({
        path: "session",
        select: "title location coach description sport sessionType timeSlots",
        populate: {
          path: "coach",
          select: "fullName email phoneNumber coachProfile",
          populate: { path: "coachProfile", select: "aboutMe bio rating profilePhoto" },
        },
      })
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const playerProfile = booking.player || null;
    const playerUser = playerProfile?.userId || null;

    const playerName = playerUser?.fullName || playerProfile?.fullName || "Unknown";
    const playerEmail = playerUser?.email || "";
    const playerPhone = playerUser?.phoneNumber || "";
    const playerRole = playerUser?.role || "player";

    const coachUser = booking.session?.coach || null;
    const coachProfile = coachUser?.coachProfile || null;

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
        id: playerProfile?._id || null,
        name: playerName,
        email: playerEmail,
        phone: playerPhone,
        role: playerRole,
        guardianId: playerProfile?.guardianId || null,
        profilePhoto: playerProfile?.profilePhoto || null,
      },
      session: {
        id: booking.session?._id || null,
        title: booking.session?.title || "",
        description: booking.session?.description || "",
        sport: booking.session?.sport || "",
        location: booking.session?.location || "",
        sessionType: booking.session?.sessionType || "",
        timeSlots: booking.session?.timeSlots || [],
      },
      coach: {
        id: coachUser?._id || null,
        name: coachUser?.fullName || "Unknown",
        email: coachUser?.email || "",
        phone: coachUser?.phoneNumber || "",
        aboutMe: coachProfile?.aboutMe || coachProfile?.bio || "",
        rating: coachProfile?.rating || 0,
        profilePhoto: coachProfile?.profilePhoto || null,
        reviews: 0,
      },
    };

    return res.status(200).json({ success: true, data: formattedBooking });
  } catch (error) {
    console.error("Admin get booking by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booking details",
      error: error.message,
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
        path: "player",
        select: "fullName email role",
      })
      .populate({
        path: "session",
        select: "title location coach sport",
        populate: {
          path: "coach",
          select: "fullName",
        },
      })
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
      player: {
        name: booking.player?.fullName || "Unknown",
        email: booking.player?.email || "",
        role: booking.player?.role || "unknown",
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