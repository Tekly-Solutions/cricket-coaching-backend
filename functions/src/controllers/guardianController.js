// controllers/guardianController.js
import mongoose from "mongoose";
import GuardianProfile from "../models/GuardianProfile.js";
import PlayerProfile from "../models/PlayerProfile.js";
import User from "../models/User.js";

/**
 * GET /api/guardian/profile
 * Get the logged-in guardian's profile (including linked players)
 */
export const getGuardianProfile = async (req, res) => {
  try {
    const profile = await GuardianProfile.findOne({ userId: req.user.userId })
      .populate({
        path: "players",
        model: "PlayerProfile",
        select: "fullName age role battingStyle bowlingStyle profilePhoto",
      })
      .lean();

    if (!profile) {
      return res.status(404).json({
        status: "error",
        message: "Guardian profile not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: profile,
    });
  } catch (error) {
    console.error("Get guardian profile error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch guardian profile",
    });
  }
};

/**
 * PUT /api/guardian/profile
 * Update guardian's profile (phone, address, etc.)
 */
export const updateGuardianProfile = async (req, res) => {
  try {
    const allowedFields = ["phoneNumber", "address"];
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

    const profile = await GuardianProfile.findOneAndUpdate(
      { userId: req.user.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({
        status: "error",
        message: "Guardian profile not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: profile,
    });
  } catch (error) {
    console.error("Update guardian profile error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to update profile",
    });
  }
};

/**
 * POST /api/guardian/players
 * Guardian creates a new MINOR player (no User account created)
 * Body: player details (name, age, role, etc.)
 */
export const createAndAddPlayer = async (req, res) => {
  try {
    const guardianId = req.user.userId;

    const {
      fullName,
      age,
      role = "Batsman",
      battingStyle = "",
      bowlingStyle = "",
      profilePhoto,
    } = req.body;

    // Validation
    if (!fullName?.trim()) {
      return res.status(400).json({
        status: "error",
        message: "Player full name is required",
      });
    }

    if (!age || isNaN(parseInt(age))) {
      return res.status(400).json({
        status: "error",
        message: "Valid age (as string) is required",
      });
    }

    const ageNum = parseInt(age);
    if (ageNum >= 16) {
      return res.status(400).json({
        status: "error",
        message: "Players 16+ must create their own account (cannot be added as minor)",
      });
    }

    // Create PlayerProfile for minor (no User document)
    const newPlayerProfile = await PlayerProfile.create({
      fullName: fullName.trim(),
      age: age.toString(),
      role,
      battingStyle,
      bowlingStyle,
      profilePhoto: profilePhoto || null,
      guardianId: guardianId,
      isSelfManaged: false,
      isMinorWithoutUser: true,
    });

    // Add this PlayerProfile to guardian's managed players list
    const updatedGuardian = await GuardianProfile.findOneAndUpdate(
      { userId: guardianId },
      { $addToSet: { players: newPlayerProfile._id } },
      { new: true, upsert: true }
    );

    return res.status(201).json({
      status: "success",
      message: "Minor player created and linked to you as guardian",
      data: {
        playerProfileId: newPlayerProfile._id,
        fullName: newPlayerProfile.fullName,
        age: newPlayerProfile.age,
        role: newPlayerProfile.role,
        isMinorWithoutUser: newPlayerProfile.isMinorWithoutUser,
      },
    });
  } catch (error) {
    console.error("Create and add player error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create player",
    });
  }
};

/**
 * POST /api/guardian/players/existing
 * (Optional) Link an EXISTING player (who already has User account) to this guardian
 */
export const addPlayerToGuardian = async (req, res) => {
  try {
    const { playerProfileId } = req.body;  // ← now expect PlayerProfile _id

    if (!playerProfileId) {
      return res.status(400).json({
        status: "error",
        message: "playerProfileId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(playerProfileId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid playerProfileId format",
      });
    }

    // Check player profile exists
    const playerProfile = await PlayerProfile.findById(playerProfileId);
    if (!playerProfile) {
      return res.status(404).json({
        status: "error",
        message: "Player profile not found",
      });
    }

    // Check if already has guardian
    if (playerProfile.guardianId) {
      return res.status(400).json({
        status: "error",
        message: "This player already has a guardian assigned",
      });
    }

    // Add to guardian
    const guardianProfile = await GuardianProfile.findOneAndUpdate(
      { userId: req.user.userId },
      { $addToSet: { players: playerProfileId } },
      { new: true }
    );

    if (!guardianProfile) {
      return res.status(404).json({
        status: "error",
        message: "Guardian profile not found",
      });
    }

    // Link back
    playerProfile.guardianId = req.user.userId;
    playerProfile.isSelfManaged = false;
    await playerProfile.save();

    return res.status(200).json({
      status: "success",
      message: "Existing player linked to guardian",
      data: guardianProfile,
    });
  } catch (error) {
    console.error("Add existing player error:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to link player",
    });
  }
};

/**
 * GET /api/guardian/players
 * Get list of players managed by this guardian
 */
export const getMyPlayers = async (req, res) => {
  try {
    const guardianProfile = await GuardianProfile.findOne({
      userId: req.user.userId,
    })
      .populate({
        path: "players",
        model: "PlayerProfile",
        select: "fullName age role battingStyle bowlingStyle profilePhoto isSelfManaged isMinorWithoutUser",
      })
      .lean();

    if (!guardianProfile) {
      return res.status(404).json({
        status: "error",
        message: "Guardian profile not found",
      });
    }

    return res.status(200).json({
      status: "success",
      results: guardianProfile.players.length,
      data: guardianProfile.players,
    });
  } catch (error) {
    console.error("Get my players error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch players",
    });
  }
};