// controllers/admin/coachController.js
import User from "../../models/User.js";
import CoachProfile from "../../models/CoachProfile.js";
import mongoose from "mongoose";

/**
 * GET /api/admin/coaches
 * Admin-only: Fetch all coaches with filters, search, pagination
 *
 * Query params:
 *   - page: number (default 1)
 *   - limit: number (default 10)
 *   - search: string (name or email)
 *   - plan: free | pro | elite | all (default all)
 *   - status: active | suspended | pending_payout | all (default all)
 *   - sort: name | -name | createdAt | -createdAt (default -createdAt)
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

    // Build base query on User
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

      // Join with CoachProfile
      {
        $lookup: {
          from: "coachprofiles",
          localField: "_id",
          foreignField: "userId",
          as: "coachProfile",
        },
      },
      { $unwind: { path: "$coachProfile", preserveNullAndEmptyArrays: true } },

      // Optional plan filter
      ...(plan !== "all" ? [{ $match: { "coachProfile.plan": plan } }] : []),

      // Project only needed fields (clean & minimal)
      {
        $project: {
          id: "$_id",
          name: "$fullName",
          email: "$email",
          plan: { $ifNull: ["$coachProfile.plan", "free"] },
          bookings: { $ifNull: ["$coachProfile.playersCoachedCount", 0] },
          status: {
            $cond: {
              if: { $eq: ["$coachProfile.isVerified", true] },
              then: "active",
              else: "pending",
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

    const coaches = await User.aggregate(pipeline);

    // Total count
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