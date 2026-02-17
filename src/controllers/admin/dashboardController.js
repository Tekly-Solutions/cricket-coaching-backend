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
      { $group: { _id: null, total: { $sum: { $ifNull: ["$pricing.total", 0] } } } },
    ]);
    const totalRevenue = Math.round(totalRevenueAgg?.[0]?.total || 0);

    // ---------- Revenue growth (this month vs last month) ----------
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [thisMonthAgg, lastMonthAgg] = await Promise.all([
      Booking.aggregate([
        { $match: { status: { $in: COMPLETED_LIKE }, createdAt: { $gte: startOfThisMonth } } },
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
    if (lastMonthRevenue > 0) revenueGrowth = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
    else if (thisMonthRevenue > 0) revenueGrowth = 100;
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
        path: "player",
        select: "fullName email userId profilePhoto guardianId",
        populate: { path: "userId", select: "fullName email phoneNumber role" },
      })
      .populate({
        path: "session",
        select: "sport coach",
        populate: { path: "coach", select: "fullName email" },
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
    // ✅ Subscription Health (Dynamic Plans)
    // - plans come from SubscriptionPlan (free/pro/elite/test/... auto)
    // - counts come from CoachProfile.plan
    // ==========================================================

    const [plansFromDb, planCountsAgg, totalCoachesProfiles, activeSubscribers, churnBase] =
      await Promise.all([
        SubscriptionPlan.find({}, { planId: 1, name: 1, price: 1, interval: 1 })
          .sort({ price: 1 })
          .lean(),
        CoachProfile.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
        CoachProfile.countDocuments({}),
        CoachProfile.countDocuments({ "subscription.status": "active" }),
        CoachProfile.countDocuments({ "subscription.status": { $in: ["cancelled", "expired"] } }),
      ]);

    const planCounts = {};
    for (const row of planCountsAgg) {
      planCounts[row._id || "unknown"] = row.count;
    }

    // Build dynamic list to return
    const plans = (plansFromDb || []).map((p) => ({
      planId: p.planId,
      name: p.name,
      price: p.price ?? 0,
      interval: p.interval ?? "month",
      count: planCounts[p.planId] || 0,
    }));

    // If CoachProfile.plan has unknown plan not in SubscriptionPlan, include it too
    const knownPlanIds = new Set(plans.map((x) => x.planId));
    Object.keys(planCounts).forEach((planId) => {
      if (!planId || planId === "unknown") return;
      if (!knownPlanIds.has(planId)) {
        plans.push({
          planId,
          name: planId,
          price: 0,
          interval: "month",
          count: planCounts[planId] || 0,
        });
      }
    });

    const conversionRate = totalCoachesProfiles > 0 ? (activeSubscribers / totalCoachesProfiles) * 100 : 0;
    const churnRate = totalCoachesProfiles > 0 ? (churnBase / totalCoachesProfiles) * 100 : 0;

    const plansBreakdown = plans.reduce((acc, p) => {
      acc[p.planId] = p.count;
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
          completedBookings,
          pendingBookings,
        },
        recentBookings,
        subscriptionHealth: {
          totalCoaches: totalCoachesProfiles,
          activeSubscribers,
          conversionRate: parseFloat(conversionRate.toFixed(1)),
          churnRate: parseFloat(churnRate.toFixed(1)),
          plans, // ✅ IMPORTANT
          plansBreakdown,
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
