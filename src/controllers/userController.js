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

    // Load role-specific profile
    if (user.role === "coach") {
      profile = await CoachProfile.findOne({ userId: user._id }).lean();
    }

    if (user.role === "player") {
      profile = await PlayerProfile.findOne({ userId: user._id }).lean();
    }

    if (user.role === "guardian") {
      profile = await GuardianProfile.findOne({ userId: user._id }).lean();
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

// Update logged-in user's profile
// export const updateUserProfile = async (req, res) => {
//   try {
//     const { fullName, email } = req.body;
//     const user = await User.findByIdAndUpdate(
//       req.user.userId,
//       { fullName, email },
//       { new: true }
//     );
//     res.json({ success: true, user });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };


export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

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
    commonFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    /* ======================
       2️⃣ UPDATE ROLE PROFILE
    ======================= */
    let profile = null;

    if (user.role === "coach") {
      const coachFields = [
        "profilePhoto",
        "coachType",
        "experienceYears",
        "aboutMe",
        "specialties",
      ];

      const updateData = {};
      coachFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      profile = await CoachProfile.findOneAndUpdate(
        { userId },
        updateData,
        { new: true }
      );
    }

    if (user.role === "player") {
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
        { new: true }
      );
    }

    if (user.role === "guardian") {
      const guardianFields = [
        "profilePhoto",
        "phone",
      ];

      const updateData = {};
      guardianFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      profile = await GuardianProfile.findOneAndUpdate(
        { userId },
        updateData,
        { new: true }
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

