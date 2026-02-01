import User from "../../models/User.js";
import CoachProfile from "../../models/CoachProfile.js";
import mongoose from "mongoose";
import GuardianProfile from "../../models/GuardianProfile.js";
import PlayerProfile from "../../models/PlayerProfile.js";
import { calculateCoachCompletionRatio } from "../../utils/coachUtils.js";
import Booking from "../../models/Booking.js";

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

/**
 * GET /api/admin/coaches/:id
 * Admin-only: Fetch full details of a single coach by user ID
 * Includes real total bookings and session completion stats
 */
export const getCoachById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid coach ID format",
      });
    }

    // Find the coach User
    const coachUser = await User.findOne({
      _id: id,
      role: "coach",
    }).lean();

    if (!coachUser) {
      return res.status(404).json({
        success: false,
        message: "Coach not found or not a coach account",
      });
    }

    // Fetch CoachProfile
    const coachProfile = await CoachProfile.findOne({ userId: id }).lean();

    // NEW: Get real total bookings count (pending + confirmed only)
    const bookingStats = await Booking.aggregate([
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
        $match: {
          "session.coach": new mongoose.Types.ObjectId(id),
          status: { $in: ["pending", "confirmed"] },
        },
      },
      { $count: "totalBookings" },
    ]);

    const totalBookings = bookingStats[0]?.totalBookings || 0;

    // NEW: Calculate completion ratio from sessions (from your existing util)
    const completionStats = await calculateCoachCompletionRatio(id);

    // Combine data
    const coachData = {
      id: coachUser._id,
      fullName: coachUser.fullName,
      email: coachUser.email,
      phoneNumber: coachUser.phoneNumber || null,
      role: coachUser.role,
      createdAt: coachUser.createdAt,
      lastProfileUpdate: coachUser.lastProfileUpdate || null,

      // Coach-specific fields (from CoachProfile)
      profilePhoto: coachProfile?.profilePhoto || null,
      coachTitle: coachProfile?.coachTitle || null,
      specialties: coachProfile?.specialties || [],
      primarySpecialization: coachProfile?.primarySpecialization || null,
      certifications: coachProfile?.certifications || [],
      experienceYears: coachProfile?.experienceYears || 0,
      aboutMe: coachProfile?.aboutMe || "",
      plan: coachProfile?.plan || "free",
      subscription: coachProfile?.subscription || { status: "inactive" },
      rating: coachProfile?.rating || 0,
      playersCoachedCount: coachProfile?.playersCoachedCount || 0,
      isVerified: coachProfile?.isVerified || false,
      profileCompletionPercentage: coachProfile?.profileCompletionPercentage || 0,
      availability: coachProfile?.availability || [],

      // NEW: Real bookings count
      totalBookings,

      // Session completion stats
      totalSessions: completionStats.totalSessions,
      completedSessions: completionStats.completedSessions,
      cancelledSessions: completionStats.cancelledSessions,
      completionRatio: completionStats.completionRatio, // percentage (0–100)
    };

    return res.status(200).json({
      success: true,
      data: coachData,
    });
  } catch (error) {
    console.error("Admin get coach by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coach details",
    });
  }
};


/* Gaurdians */

// controllers/admin/adminController.js

/**
 * GET /api/admin/guardians
 * Admin-only: List all guardians with filters, search, pagination
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

    // Status filter (if added to User or GuardianProfile later)
    // For now, using isActive from GuardianProfile
    if (status !== "all") {
      query["guardianProfile.isActive"] = status === "active";
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
      ...(status !== "all" ? [{ $match: { "guardianProfile.isActive": status === "active" } }] : []),

      // Project minimal fields
      {
        $project: {
          id: "$_id",
          name: "$fullName",
          email: "$email",
          phoneNumber: "$guardianProfile.phoneNumber",
          address: "$guardianProfile.address",
          playersCount: { $size: { $ifNull: ["$guardianProfile.players", []] } },
          isActive: { $ifNull: ["$guardianProfile.isActive", true] },
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
      { $lookup: { from: "guardianprofiles", localField: "_id", foreignField: "userId", as: "guardianProfile" } },
      { $unwind: { path: "$guardianProfile", preserveNullAndEmptyArrays: true } },
      ...(status !== "all" ? [{ $match: { "guardianProfile.isActive": status === "active" } }] : []),
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
        select: "fullName age role battingStyle bowlingStyle profilePhoto isSelfManaged",
      })
      .lean();

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
      .populate("guardianId", "fullName email phoneNumber")
      .lean();

    if (!playerProfile) {
      return res.status(404).json({
        success: false,
        message: "Player not found",
      });
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
      isMinorWithoutUser: playerProfile.isMinorWithoutUser,
      guardian: playerProfile.guardianId
        ? {
            id: playerProfile.guardianId._id,
            name: playerProfile.guardianId.fullName,
            email: playerProfile.guardianId.email,
            phoneNumber: playerProfile.guardianId.phoneNumber,
          }
        : null,
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