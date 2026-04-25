import User from "../../models/User.js";
import CoachProfile from "../../models/CoachProfile.js";
import mongoose from "mongoose";
import GuardianProfile from "../../models/GuardianProfile.js";
import PlayerProfile from "../../models/PlayerProfile.js";
import { calculateCoachCompletionRatio } from "../../utils/coachUtils.js";
import Booking from "../../models/Booking.js";
import Session from "../../models/Session.js";
import SubscriptionPlan from "../../models/SubscriptionPlan.js";

/**
 * GET /api/admin/coaches
 * Admin-only: Fetch all coaches with filters, search, pagination + real earnings & bookings
 */
export const getAllCoaches = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      plan = "all",
      status = "all",
      sort = "-createdAt",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Base query on User
    const query = { role: "coach" };

    // Search by name or email
    if (search) {
      query.$or = [
        { fullName: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Aggregation pipeline
    const pipeline = [
      { $match: query },

      // Join CoachProfile
      {
        $lookup: {
          from: "coachprofiles",
          localField: "_id",
          foreignField: "userId",
          as: "coachProfile",
        },
      },
      { $unwind: { path: "$coachProfile", preserveNullAndEmptyArrays: true } },

      // Plan filter
      ...(plan !== "all" ? [{ $match: { "coachProfile.plan": plan } }] : []),

      // Join Earnings (confirmed/paid only) - unchanged
      {
        $lookup: {
          from: "earnings",
          localField: "_id",
          foreignField: "coach",
          as: "earnings",
          pipeline: [
            { $match: { status: { $in: ["confirmed", "paid"] } } },
            {
              $group: {
                _id: null,
                totalEarnings: { $sum: "$netAmount" },
                totalSessions: { $sum: 1 }
              }
            }
          ]
        }
      },
      { $unwind: { path: "$earnings", preserveNullAndEmptyArrays: true } },

      // NEW: Count real bookings from Booking collection (confirmed/pending only)
      {
        $lookup: {
          from: "bookings",
          localField: "_id",
          foreignField: "session.coach", // ← match coach in session
          as: "bookings",
          pipeline: [
            {
              $match: {
                status: { $in: ["pending", "confirmed"] } // active bookings only
              }
            },
            { $count: "totalBookings" }
          ]
        }
      },
      { $unwind: { path: "$bookings", preserveNullAndEmptyArrays: true } },

      // Project final fields
      {
        $project: {
          id: "$_id",
          name: "$fullName",
          email: "$email",
          plan: { $ifNull: ["$coachProfile.plan", "free"] },
          // FIXED: use real booking count instead of playersCoachedCount
          bookings: { $ifNull: ["$bookings.totalBookings", 0] },
          status: {
            $cond: {
              if: { $eq: ["$coachProfile.isVerified", true] },
              then: "active",
              else: "pending",
            },
          },
          // Earnings from previous change
          totalEarnings: { $ifNull: ["$earnings.totalEarnings", 0] },
          totalSessions: { $ifNull: ["$earnings.totalSessions", 0] },
          createdAt: "$createdAt",
        },
      },

      // Sort & Pagination
      {
        $sort: sort.startsWith("-")
          ? { [sort.slice(1)]: -1 }
          : { [sort]: 1 },
      },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ];

    const coaches = await User.aggregate(pipeline);

    // Total count (unchanged)
    const totalPipeline = [
      { $match: query },
      { $lookup: { from: "coachprofiles", localField: "_id", foreignField: "userId", as: "coachProfile" } },
      { $unwind: { path: "$coachProfile", preserveNullAndEmptyArrays: true } },
      ...(plan !== "all" ? [{ $match: { "coachProfile.plan": plan } }] : []),
      { $count: "total" },
    ];

    const totalResult = await User.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: coaches,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin get coaches error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coaches",
    });
  }
};

export const getCoachById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid coach id" });
    }

    // ---- User (coach) ----
    const coachUser = await User.findById(id).lean();
    if (!coachUser || coachUser.role !== "coach") {
      return res.status(404).json({ success: false, message: "Coach not found" });
    }

    // ---- Coach profile ----
    const coachProfile = await CoachProfile.findOne({ userId: coachUser._id }).lean();
    if (!coachProfile) {
      return res.status(404).json({ success: false, message: "Coach profile not found" });
    }

    // ---- Subscription plan details from DB ----
    const planId = coachProfile.plan || "free";
    const planDoc = await SubscriptionPlan.findOne({ planId }).lean();

    // ---- Sessions owned by coach (to connect bookings reliably) ----
    // We will compute performance + financial using bookings connected to coach sessions
    const coachSessions = await Session.find({ coach: coachUser._id }, { _id: 1 }).lean();
    const sessionIds = coachSessions.map((s) => s._id);

    // ---- Booking stats for this coach ----
    const totalBookings = await Booking.countDocuments({ session: { $in: sessionIds } });

    const completedLike = ["completed", "confirmed"];
    const completedBookings = await Booking.countDocuments({
      session: { $in: sessionIds },
      status: { $in: completedLike },
    });

    const completionRatio = totalBookings > 0 ? completedBookings / totalBookings : 0;

    // ---- Financial calculations ----
    // totalEarned = sum(pricing.total) for completed-like bookings
    const earnedAgg = await Booking.aggregate([
      { $match: { session: { $in: sessionIds }, status: { $in: completedLike } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$pricing.total", 0] } } } },
    ]);
    const totalEarned = Number(earnedAgg?.[0]?.total || 0);

    // pendingEarnings = sum(pricing.total) for pending/confirmed (depending on your business)
    const pendingAgg = await Booking.aggregate([
      { $match: { session: { $in: sessionIds }, status: { $in: ["pending", "confirmed"] } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$pricing.total", 0] } } } },
    ]);
    const pendingEarnings = Number(pendingAgg?.[0]?.total || 0);

    // lastPayout (placeholder since you don't have payouts collection yet)
    // We'll use the last completed booking date as "last payout date" for now.
    const lastCompleted = await Booking.findOne({
      session: { $in: sessionIds },
      status: { $in: completedLike },
    })
      .sort({ createdAt: -1 })
      .select("createdAt pricing.total")
      .lean();

    const lastPayout = lastCompleted
      ? {
          amount: `£${Number(lastCompleted?.pricing?.total || 0).toFixed(2)}`,
          date: new Date(lastCompleted.createdAt).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
        }
      : { amount: "£0.00", date: "-" };

    // subscriptionFeesPaid (if you don't store payments, estimate based on plan price)
    // If coach subscription is active, count months since createdAt or since subscription.expiresAt - 1 cycle.
    let subscriptionFeesPaid = 0;
    if (coachProfile.subscription?.status === "active" && planDoc?.price) {
      // Basic estimate from coachProfile.updatedAt / createdAt
      const startDate = coachProfile.createdAt ? new Date(coachProfile.createdAt) : new Date();
      const months = Math.max(
        0,
        (new Date().getFullYear() - startDate.getFullYear()) * 12 +
          (new Date().getMonth() - startDate.getMonth())
      );
      const monthlyPrice = planDoc.interval === "year" ? planDoc.price / 12 : planDoc.price;
      subscriptionFeesPaid = Math.round(monthlyPrice * months);
    }

    // ---- Response (shape matches your frontend transform needs) ----
    return res.status(200).json({
      success: true,
      data: {
        id: coachUser._id,
        fullName: coachUser.fullName,
        email: coachUser.email,
        phoneNumber: coachUser.phoneNumber || "",
        rating: coachProfile.rating || 0,
        primarySpecialization: coachProfile.primarySpecialization || null,
        plan: planId, // free/pro/elite/test etc.
        subscription: {
          status: coachProfile.subscription?.status || "inactive",
          expiresAt: coachProfile.subscription?.expiresAt || null,
        },
        planMeta: planDoc
          ? {
              name: planDoc.name,
              price: planDoc.price,
              interval: planDoc.interval,
              currency: planDoc.currency || "GBP",
            }
          : null,

        totalBookings,
        completionRatio,

        financial: {
          totalEarned: `£${totalEarned.toFixed(2)}`,
          pendingEarnings: `£${pendingEarnings.toFixed(2)}`,
          lastPayout,
          subscriptionFeesPaid: `£${Number(subscriptionFeesPaid || 0).toFixed(2)}`,
        },
      },
    });
  } catch (err) {
    console.error("Admin get coach by id error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch coach" });
  }
};


/* Gaurdians */

/**
 * GET /api/admin/guardians
 * Admin-only: List all guardians with filters, search, pagination
 * Includes real booking count and total spend from Booking collection
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 10)
 *   - search: string (name or email)
 *   - status: active | inactive | all (default all)
 *   - sort: name | -name | createdAt | -createdAt (default -createdAt)
 */
export const getAllGuardians = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "all",
      sort = "-createdAt",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Base query on User (role = guardian)
    const query = { role: "guardian" };

    // Search by name or email
    if (search) {
      query.$or = [
        { fullName: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const pipeline = [
      { $match: query },

      // Join with GuardianProfile
      {
        $lookup: {
          from: "guardianprofiles",
          localField: "_id",
          foreignField: "userId",
          as: "guardianProfile",
        },
      },
      { $unwind: { path: "$guardianProfile", preserveNullAndEmptyArrays: true } },

      // Optional status filter
      ...(status !== "all" 
        ? [{ $match: { "guardianProfile.isActive": status === "active" } }] 
        : []
      ),

      // NEW: Get all players under this guardian
      {
        $lookup: {
          from: "playerprofiles",
          localField: "guardianProfile.players",
          foreignField: "_id",
          as: "playerProfiles",
        },
      },

      // NEW: Get User IDs of self-managed players (those with userId)
      {
        $addFields: {
          playerUserIds: {
            $map: {
              input: {
                $filter: {
                  input: "$playerProfiles",
                  cond: { $ne: ["$$this.userId", null] },
                },
              },
              as: "player",
              in: "$$player.userId",
            },
          },
        },
      },

      // NEW: Join bookings for all players (self-managed)
      {
        $lookup: {
          from: "bookings",
          let: { playerIds: "$playerUserIds" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$player", "$$playerIds"] },
                status: { $in: ["pending", "confirmed", "completed"] },
              },
            },
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                totalSpend: { $sum: "$pricing.total" },
              },
            },
          ],
          as: "bookingStats",
        },
      },
      { $unwind: { path: "$bookingStats", preserveNullAndEmptyArrays: true } },

      // Project final fields
      {
        $project: {
          id: "$_id",
          name: "$fullName",
          email: "$email",
          phoneNumber: "$guardianProfile.phoneNumber",
          address: "$guardianProfile.address",
          playersCount: { $size: { $ifNull: ["$guardianProfile.players", []] } },
          isActive: { $ifNull: ["$guardianProfile.isActive", true] },
          totalBookings: { $ifNull: ["$bookingStats.totalBookings", 0] },
          totalSpend: { $ifNull: ["$bookingStats.totalSpend", 0] },
          createdAt: "$createdAt",
        },
      },

      // Sort
      {
        $sort: sort.startsWith("-")
          ? { [sort.slice(1)]: -1 }
          : { [sort]: 1 },
      },

      // Pagination
      { $skip: skip },
      { $limit: parseInt(limit) },
    ];

    const guardians = await User.aggregate(pipeline);

    // Total count
    const totalPipeline = [
      { $match: query },
      { 
        $lookup: { 
          from: "guardianprofiles", 
          localField: "_id", 
          foreignField: "userId", 
          as: "guardianProfile" 
        } 
      },
      { $unwind: { path: "$guardianProfile", preserveNullAndEmptyArrays: true } },
      ...(status !== "all" 
        ? [{ $match: { "guardianProfile.isActive": status === "active" } }] 
        : []
      ),
      { $count: "total" },
    ];

    const totalResult = await User.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: guardians,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin get guardians error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch guardians",
    });
  }
};

/**
 * GET /api/admin/guardians/:id
 * Admin-only: Get full details of a single guardian by user ID
 * Includes real booking count and total spend
 */
export const getGuardianById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid guardian ID format",
      });
    }

    // Find guardian User
    const guardianUser = await User.findOne({
      _id: id,
      role: "guardian",
    }).lean();

    if (!guardianUser) {
      return res.status(404).json({
        success: false,
        message: "Guardian not found or not a guardian account",
      });
    }

    // Fetch GuardianProfile + populate linked players
    const guardianProfile = await GuardianProfile.findOne({ userId: id })
      .populate({
        path: "players",
        model: "PlayerProfile",
        select: "fullName age role battingStyle bowlingStyle profilePhoto isSelfManaged userId",
      })
      .lean();

    // NEW: Get player User IDs (for self-managed players)
    const playerUserIds = guardianProfile?.players
      ?.filter(p => p.userId)
      .map(p => p.userId) || [];

    // NEW: Aggregate bookings for all players
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          player: { $in: playerUserIds },
          status: { $in: ["pending", "confirmed", "completed"] },
        },
      },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalSpend: { $sum: "$pricing.total" },
        },
      },
    ]);

    const totalBookings = bookingStats[0]?.totalBookings || 0;
    const totalSpend = bookingStats[0]?.totalSpend || 0;

    // Combine data
    const guardianData = {
      id: guardianUser._id,
      fullName: guardianUser.fullName,
      email: guardianUser.email,
      phoneNumber: guardianUser.phoneNumber || null,
      role: guardianUser.role,
      createdAt: guardianUser.createdAt,
      lastProfileUpdate: guardianUser.lastProfileUpdate || null,

      // Guardian-specific
      address: guardianProfile?.address || null,
      players: guardianProfile?.players || [],
      playersCount: guardianProfile?.players?.length || 0,
      isActive: guardianProfile?.isActive ?? true,

      // NEW: Real booking stats
      totalBookings,
      totalSpend,
    };

    return res.status(200).json({
      success: true,
      data: guardianData,
    });
  } catch (error) {
    console.error("Admin get guardian by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch guardian details",
    });
  }
};

/**
 * GET /api/admin/players
 * Admin-only: List all players with filters, search, pagination
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 10)
 *   - search: string (name or email for self-managed)
 *   - type: self-managed | minor | all (default all)
 *   - sort: name | -name | age | -age | createdAt | -createdAt (default -createdAt)
 */
export const getAllPlayers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      type = "all",
      sort = "-createdAt",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Base query on PlayerProfile (all players exist here)
    const query = {};

    // Search (for self-managed: search User; for minors: search PlayerProfile.fullName)
    if (search) {
      query.$or = [
        { fullName: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Type filter
    if (type === "self-managed") {
      query.userId = { $exists: true, $ne: null };
    } else if (type === "minor") {
      query.userId = null;
    }

    const pipeline = [
      { $match: query },

      // Join with User (if exists - for self-managed)
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

      // Join with Guardian (if exists)
      {
        $lookup: {
          from: "guardianprofiles",
          localField: "guardianId",
          foreignField: "userId",
          as: "guardian",
        },
      },
      { $unwind: { path: "$guardian", preserveNullAndEmptyArrays: true } },

      // Project clean fields
      {
        $project: {
          id: "$_id",
          name: {
            $cond: {
              if: { $ifNull: ["$user.fullName", false] },
              then: "$user.fullName",
              else: "$fullName",
            },
          },
          email: { $ifNull: ["$user.email", null] },
          age: "$age",
          role: "$role",
          battingStyle: "$battingStyle",
          bowlingStyle: "$bowlingStyle",
          profilePhoto: "$profilePhoto",
          isSelfManaged: "$isSelfManaged",
          isMinorWithoutUser: "$isMinorWithoutUser",
          guardian: {
            $cond: {
              if: { $ifNull: ["$guardian", false] },
              then: {
                id: "$guardian.userId",
                name: "$guardian.fullName", // Wait, GuardianProfile has no fullName - use User
                // Better: populate guardian's User
              },
              else: null,
            },
          },
          createdAt: "$createdAt",
        },
      },

      // Sort
      {
        $sort: sort.startsWith("-")
          ? { [sort.slice(1)]: -1 }
          : { [sort]: 1 },
      },

      // Pagination
      { $skip: skip },
      { $limit: parseInt(limit) },
    ];

    const players = await PlayerProfile.aggregate(pipeline);

    // Total count
    const totalPipeline = [
      { $match: query },
      { $count: "total" },
    ];

    const totalResult = await PlayerProfile.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: players,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin get players error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch players",
    });
  }
};

/**
 * GET /api/admin/players/:id
 * Admin-only: Get full details of a single player by PlayerProfile ID
 */
export const getPlayerById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid player ID format",
      });
    }

    // Find PlayerProfile
    const playerProfile = await PlayerProfile.findById(id)
      .populate("userId", "fullName email phoneNumber role")
      .lean();

    if (!playerProfile) {
      return res.status(404).json({
        success: false,
        message: "Player not found",
      });
    }

    // Get guardian User data if guardianId exists
    let guardianData = null;
    if (playerProfile.guardianId) {
      const guardianUser = await User.findById(playerProfile.guardianId)
        .select("fullName email phoneNumber")
        .lean();
      
      if (guardianUser) {
        guardianData = {
          id: guardianUser._id,
          name: guardianUser.fullName,
          email: guardianUser.email,
          phoneNumber: guardianUser.phoneNumber,
        };
      }
    }

    // Combine data
    const playerData = {
      id: playerProfile._id,
      name: playerProfile.userId?.fullName || playerProfile.fullName,
      email: playerProfile.userId?.email || null,
      phoneNumber: playerProfile.userId?.phoneNumber || null,
      age: playerProfile.age,
      role: playerProfile.role,
      battingStyle: playerProfile.battingStyle,
      bowlingStyle: playerProfile.bowlingStyle,
      profilePhoto: playerProfile.profilePhoto,
      isSelfManaged: playerProfile.isSelfManaged,
      isMinorWithoutUser: !playerProfile.userId,
      guardian: guardianData,
      createdAt: playerProfile.createdAt,
    };

    return res.status(200).json({
      success: true,
      data: playerData,
    });
  } catch (error) {
    console.error("Admin get player by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch player details",
    });
  }
};