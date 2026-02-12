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
      medicalIssues,
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
      medicalIssues: medicalIssues || "",
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
    let guardianProfile = await GuardianProfile.findOne({
      userId: req.user.userId,
    })
      .populate({
        path: "players",
        model: "PlayerProfile",
        select: "fullName age role battingStyle bowlingStyle profilePhoto isSelfManaged isMinorWithoutUser",
      })
      .lean();

    if (!guardianProfile) {
      console.log(`[GetMyPlayers] Profile not found for user ${req.user.userId}. Auto-creating...`);
      // Auto-create profile if missing (Self-healing)
      const newProfile = await GuardianProfile.create({
        userId: req.user.userId,
        players: []
      });

      return res.status(200).json({
        status: "success",
        results: 0,
        data: [],
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

/**
 * GET /api/guardian/player/:id
 * Get details of a specific player managed by guardian
 */
export const getPlayerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const guardianId = req.user.userId;

    // Verify this player belongs to the guardian
    const guardianProfile = await GuardianProfile.findOne({
      userId: guardianId,
      players: id,
    });

    if (!guardianProfile) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to view this player",
      });
    }

    const playerProfile = await PlayerProfile.findById(id).lean();

    if (!playerProfile) {
      return res.status(404).json({
        status: "error",
        message: "Player not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: playerProfile,
    });
  } catch (error) {
    console.error("Get player details error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch player details",
    });
  }
};

/**
 * DELETE /api/guardian/player/:id
 * Remove a player from guardian's managed players
 */
export const removePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const guardianId = req.user.userId;

    // Verify this player belongs to the guardian
    const guardianProfile = await GuardianProfile.findOne({
      userId: guardianId,
      players: id,
    });

    if (!guardianProfile) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to remove this player",
      });
    }

    // Remove player from guardian's players array
    await GuardianProfile.findOneAndUpdate(
      { userId: guardianId },
      { $pull: { players: id } }
    );

    // Delete the player profile
    await PlayerProfile.findByIdAndDelete(id);

    return res.status(200).json({
      status: "success",
      message: "Player removed successfully",
    });
  } catch (error) {
    console.error("Remove player error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to remove player",
    });
  }
};/**
 * PUT /api/guardian/player/:id
 * Update a player's profile
 */
export const updatePlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const guardianId = req.user.userId;

    const guardianProfile = await GuardianProfile.findOne({
      userId: guardianId,
      players: id,
    });

    if (!guardianProfile) {
      return res.status(403).json({
        status: "error",
        message: "You do not have permission to update this player",
      });
    }

    const { fullName, age, role, battingStyle, bowlingStyle, medicalIssues } = req.body;

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (age !== undefined) updateData.age = age;
    if (role !== undefined) updateData.role = role;
    if (battingStyle !== undefined) updateData.battingStyle = battingStyle;
    if (bowlingStyle !== undefined) updateData.bowlingStyle = bowlingStyle;
    if (medicalIssues !== undefined) updateData.medicalIssues = medicalIssues;

    const updatedPlayer = await PlayerProfile.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPlayer) {
      return res.status(404).json({
        status: "error",
        message: "Player not found",
      });
    }

    return res.status(200).json({
      status: "success",
      data: updatedPlayer,
      message: "Player updated successfully",
    });
  } catch (error) {
    console.error("Update player error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to update player",
    });
  }
};