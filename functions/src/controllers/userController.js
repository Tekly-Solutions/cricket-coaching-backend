import User from "../models/User.js";
import CoachProfile from "../models/CoachProfile.js";
import PlayerProfile from "../models/PlayerProfile.js";
import GuardianProfile from "../models/GuardianProfile.js";

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let profile = null;

    const role = user.role.toLowerCase();

    // Load role-specific profile
    if (role === "coach") {
      profile = await CoachProfile.findOne({ userId: user._id }).lean();
      if (!profile) {
        // Lazy create if missing
        profile = await CoachProfile.create({ userId: user._id, plan: "free", isVerified: false });
      }
    }

    if (role === "player") {
      profile = await PlayerProfile.findOne({ userId: user._id }).lean();
      if (!profile) {
        profile = await PlayerProfile.create({ userId: user._id, role: 'player', isSelfManaged: true });
      }
    }

    if (role === "guardian") {
      profile = await GuardianProfile.findOne({ userId: user._id }).lean();
      if (!profile) {
        profile = await GuardianProfile.create({ userId: user._id });
      }
    }

    return res.status(200).json({
      success: true,
      user,
      profile, // role-based profile
    });
  } catch (err) {
    console.error("Get user profile error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const updateUserProfile = async (req, res) => {
  console.log("🚀🚀🚀 UPDATE PROFILE FUNCTION CALLED 🚀🚀🚀");
  try {
    const userId = req.user.userId;

    console.log("📝 UPDATE PROFILE REQUEST:");
    console.log("   Body:", JSON.stringify(req.body, null, 2));
    console.log("   User ID:", userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    /* ======================
       1️⃣ UPDATE COMMON USER
    ======================= */
    const commonFields = ["fullName", "email"];

    // Check for phone/phoneNumber and update user.phoneNumber
    if (req.body.phone !== undefined) {
      console.log("📞 Setting user.phoneNumber from 'phone':", req.body.phone);
      user.phoneNumber = req.body.phone;
    }
    if (req.body.phoneNumber !== undefined) {
      console.log("📞 Setting user.phoneNumber from 'phoneNumber':", req.body.phoneNumber);
      user.phoneNumber = req.body.phoneNumber;
    }

    commonFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    console.log("💾 Saving user. phoneNumber value:", user.phoneNumber);
    await user.save();
    console.log("✅ User saved successfully. Final phoneNumber:", user.phoneNumber);

    /* ======================
       2️⃣ UPDATE ROLE PROFILE
    ======================= */
    let profile = null;
    const role = user.role.toLowerCase();

    if (role === "coach") {
      const coachFields = [
        "profilePhoto",
        "coachType",
        "experienceYears",
        "aboutMe",
        "specialties",
        "city",
        "country",
        "coachTitle",
        "bio",
        "primarySpecialization",
        "certifications",
        "coachingPhilosophy",
        "notableAchievements",
        "playingCareerBackground",
        "ageGroupsCoached",
        "sessionTypesOffered",
      ];

      const updateData = {};
      coachFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      // Handle currency: save both as top-level and inside defaultPricing
      if (req.body.currency !== undefined) {
        updateData.currency = req.body.currency;
        updateData['defaultPricing.currency'] = req.body.currency;
      }

      // Handle hourlyRate and sessionDuration for defaultPricing
      if (req.body.hourlyRate !== undefined) {
        updateData['defaultPricing.hourlyRate'] = req.body.hourlyRate;
      }
      if (req.body.sessionDuration !== undefined) {
        updateData['defaultPricing.sessionDuration'] = req.body.sessionDuration;
      }

      profile = await CoachProfile.findOneAndUpdate(
        { userId },
        updateData,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    if (role === "player") {
      const playerFields = [
        "profilePhoto",
        "age",
        "skillLevel",
        "preferredPosition",
      ];

      const updateData = {};
      playerFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      profile = await PlayerProfile.findOneAndUpdate(
        { userId },
        updateData,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    if (role === "guardian") {
      const guardianFields = [
        "profilePhoto",
        "address",
      ];

      const updateData = {};

      // Map phone to phoneNumber
      if (req.body.phone !== undefined) {
        console.log("📞 Setting GuardianProfile.phoneNumber from 'phone':", req.body.phone);
        updateData.phoneNumber = req.body.phone;
      }
      if (req.body.phoneNumber !== undefined) {
        console.log("📞 Setting GuardianProfile.phoneNumber from 'phoneNumber':", req.body.phoneNumber);
        updateData.phoneNumber = req.body.phoneNumber;
      }
      console.log("💾 GuardianProfile updateData:", updateData);

      guardianFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      profile = await GuardianProfile.findOneAndUpdate(
        { userId },
        updateData,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user,
      profile,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};