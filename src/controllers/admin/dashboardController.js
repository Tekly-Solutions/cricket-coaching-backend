// controllers/admin/dashboardController.js
import Booking from "../../models/Booking.js";
import User from "../../models/User.js";
import CoachProfile from "../../models/CoachProfile.js";
import SubscriptionPlan from "../../models/SubscriptionPlan.js";

/**
 * GET /api/admin/dashboard/overview
 * Admin-only: Dashboard overview (stats + recent bookings + subscription health)
 * MVP rule: "confirmed" is treated as "completed-like" for stats & revenue
 */
export const getDashboardOverview = async (req, res) => {
  try {
    const COMPLETED_LIKE = ["completed", "confirmed"];

    // ---------- Booking counts ----------
    const [totalBookings, completedBookings, pendingBookings] = await Promise.all([
      Booking.countDocuments({}),
      Booking.countDocuments({ status: { $in: COMPLETED_LIKE } }),
      Booking.countDocuments({ status: "pending" }),
    ]);

    // ---------- Total revenue (completed-like only) ----------
    const totalRevenueAgg = await Booking.aggregate([
      { $match: { status: { $in: COMPLETED_LIKE } } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$pricing.total", 0] } },
        },
      },
    ]);
    const totalRevenue = Math.round(totalRevenueAgg?.[0]?.total || 0);

    // ---------- Revenue growth (this month vs last month) ----------
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthAgg, lastMonthAgg] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            status: { $in: COMPLETED_LIKE },
            createdAt: { $gte: startOfThisMonth },
          },
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$pricing.total", 0] } } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            status: { $in: COMPLETED_LIKE },
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$pricing.total", 0] } } } },
      ]),
    ]);

    const thisMonthRevenue = thisMonthAgg?.[0]?.total || 0;
    const lastMonthRevenue = lastMonthAgg?.[0]?.total || 0;

    let revenueGrowth = 0;
    if (lastMonthRevenue > 0) {
      revenueGrowth = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    } else if (thisMonthRevenue > 0) {
      revenueGrowth = 100;
    }
    revenueGrowth = parseFloat(revenueGrowth.toFixed(1));

    // ---------- Active counts ----------
    const [activeCoaches, activeParents] = await Promise.all([
      User.countDocuments({ role: "coach" }),
      User.countDocuments({ role: { $in: ["guardian", "parent"] } }),
    ]);

    // ---------- Recent bookings ----------
    const recentRaw = await Booking.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({
        path: "player", // PlayerProfile
        select: "fullName email userId profilePhoto guardianId",
        populate: {
          path: "userId", // User
          select: "fullName email phoneNumber role",
        },
      })
      .populate({
        path: "session",
        select: "sport coach",
        populate: {
          path: "coach",
          select: "fullName email",
        },
      })
      .lean();

    const recentBookings = recentRaw.map((b) => {
      const playerProfile = b.player || null;
      const playerUser = playerProfile?.userId || null;

      const playerName = playerUser?.fullName || playerProfile?.fullName || "Unknown";
      const playerEmail = playerUser?.email || playerProfile?.email || "";

      return {
        id: b._id,
        bookingId: b.referenceNumber || "",
        status: b.status || "pending",
        createdAt: b.createdAt,
        occurrenceDate: b.occurrenceDate,
        sport: b.session?.sport || "Unknown",
        price: b.pricing?.sessionFee || 0,
        total: b.pricing?.total || 0,
        player: { name: playerName, email: playerEmail },
        coach: { name: b.session?.coach?.fullName || "Unknown" },
      };
    });

    // ==========================================================
    // ✅ Subscription Health (Scalable)
    // Source of truth for coaches: CoachProfile.plan (free/pro/elite)
    // Paid/active: CoachProfile.subscription.status === "active"
    // ==========================================================

    // Get planIds from SubscriptionPlan collection (so it adapts to future plans)
    const plans = await SubscriptionPlan.find({}, { planId: 1 }).lean();
    const planIds = plans.map((p) => p.planId); // e.g. ["free","pro","elite"] based on DB

    // Count coaches per plan (only coach profiles)
    const planCountsAgg = await CoachProfile.aggregate([
      {
        $group: {
          _id: "$plan",
          count: { $sum: 1 },
        },
      },
    ]);

    const planCounts = {};
    for (const row of planCountsAgg) {
      planCounts[row._id || "unknown"] = row.count;
    }

    const totalCoachesProfiles = await CoachProfile.countDocuments({});

    // UI currently shows Free + Pro. We compute those safely.
    const freeCount = planCounts["free"] || 0;
    const proCount = planCounts["pro"] || 0;

    // Conversion: active paid subscribers / total coaches
    // Treat "active" as a paid subscriber (you can expand later)
    const activeSubscribers = await CoachProfile.countDocuments({
      "subscription.status": "active",
    });

    const conversionRate =
      totalCoachesProfiles > 0 ? (activeSubscribers / totalCoachesProfiles) * 100 : 0;

    // Churn: only meaningful if you track cancellations/expiry.
    // We'll compute a simple current churn snapshot:
    // churn = cancelled or expired / total coaches
    const churnBase = await CoachProfile.countDocuments({
      "subscription.status": { $in: ["cancelled", "expired"] },
    });
    const churnRate =
      totalCoachesProfiles > 0 ? (churnBase / totalCoachesProfiles) * 100 : 0;

    // Optional: return all plan breakdown (future-proof, not required by UI now)
    const plansBreakdown = planIds.reduce((acc, id) => {
      acc[id] = planCounts[id] || 0;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalRevenue,
          revenueGrowth,
          activeCoaches,
          activeParents,
          totalBookings,
          completedBookings, // ✅ includes confirmed + completed
          pendingBookings,
        },
        recentBookings,
        subscriptionHealth: {
          totalCoaches: totalCoachesProfiles,
          freeCount,
          proCount,
          activeSubscribers,
          conversionRate: parseFloat(conversionRate.toFixed(1)),
          churnRate: parseFloat(churnRate.toFixed(1)),
          plansBreakdown, // ✅ scalable for later charts
        },
      },
    });
  } catch (error) {
    console.error("Admin dashboard overview error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard overview",
      error: error?.message,
    });
  }
};
