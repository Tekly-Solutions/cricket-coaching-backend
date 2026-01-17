import mongoose from "mongoose";
import PlayerProfile from "../models/PlayerProfile.js";
import User from "../models/User.js";

/**
 * GET /api/player/profile
 * Get the logged-in player's profile
 */
export const getPlayerProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const profile = await PlayerProfile.findOne({ userId })
      .populate("guardianId", "fullName email phoneNumber") // populate guardian info if exists
      .lean();

    if (!profile) {
      return res.status(404).json({
        status: "error",
        message: "Player profile not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: profile,
    });
  } catch (error) {
    console.error("Get player profile error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch player profile",
    });
  }
};

/**
 * PUT /api/player/profile
 * Update the logged-in player's profile
 * Allowed fields: profilePhoto, role, battingStyle, bowlingStyle, age
 */
export const updatePlayerProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Validate userId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid userId format",
      });
    }

    // 🚫 Reject empty body
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Request body cannot be empty",
      });
    }

    const allowedFields = [
      "profilePhoto",
      "role",
      "battingStyle",
      "bowlingStyle",
      "age",
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: "error",
        message: "No valid fields to update",
      });
    }

    // Optional: Prevent changing age if under 16 (business rule example)
    if (updates.age) {
      const ageNum = parseInt(updates.age, 10);
      if (!isNaN(ageNum) && ageNum < 16) {
        updates.isSelfManaged = false;
        // You can also force guardianId check here if needed
      }
    }

    const updatedProfile = await PlayerProfile.findOneAndUpdate(
      { userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({
        status: "error",
        message: "Player profile not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: updatedProfile,
    });
  } catch (error) {
    console.error("Update player profile error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update profile",
    });
  }
};