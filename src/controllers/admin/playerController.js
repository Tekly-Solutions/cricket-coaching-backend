import mongoose from "mongoose";
import PlayerProfile from "../../models/PlayerProfile.js";
import Booking from "../../models/Booking.js";
import User from "../../models/User.js";

/**
 * GET /api/admin/players/:id/bookings/recent
 * Admin-only: Get recent bookings for a player with stats
 */
export const getPlayerRecentBookings = async (req, res) => {
  try {
    const { id } = req.params; // This is PlayerProfile ID

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid player ID",
      });
    }

    // Get PlayerProfile to find userId
    const playerProfile = await PlayerProfile.findById(id).lean();

    if (!playerProfile) {
      return res.status(404).json({
        success: false,
        message: "Player not found",
      });
    }

    // If no userId (minor without account), return empty
    if (!playerProfile.userId) {
      return res.status(200).json({
        success: true,
        data: [],
        stats: {
          totalSessions: 0,
          hoursTrained: 0,
          lastSession: null,
        },
      });
    }

    // Get all bookings for this player
    const bookings = await Booking.find({
      player: playerProfile.userId,
    })
      .populate({
        path: "session",
        select: "title location coach timeSlots",
        populate: { path: "coach", select: "fullName" },
      })
      .sort({ occurrenceDate: -1 })
      .limit(10)
      .lean();

    // Calculate stats
    const totalSessions = bookings.length;
    
    // Calculate hours trained (sum of session durations)
    const hoursTrained = bookings.reduce((total, booking) => {
      const session = booking.session;
      if (session?.timeSlots && session.timeSlots.length > 0) {
        const slot = session.timeSlots[0];
        const durationHours = slot.durationMinutes / 60;
        return total + durationHours;
      }
      return total;
    }, 0);

    // Get last session date
    const lastSession = bookings.length > 0 
      ? bookings[0].occurrenceDate 
      : null;

    // Format bookings
    const formattedBookings = bookings.map((booking) => {
      const session = booking.session;
      let duration = 0;
      
      if (session?.timeSlots && session.timeSlots.length > 0) {
        duration = session.timeSlots[0].durationMinutes;
      }

      return {
        id: booking._id,
        date: booking.occurrenceDate,
        coachName: session?.coach?.fullName || "Unknown",
        sport: "Cricket", // You can add this to session schema if needed
        duration: duration, // in minutes
        status: booking.status,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedBookings,
      stats: {
        totalSessions,
        hoursTrained: Math.round(hoursTrained * 10) / 10, // Round to 1 decimal
        lastSession,
      },
    });
  } catch (error) {
    console.error("Admin player recent bookings error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch player bookings",
      error: error.message,
    });
  }
};