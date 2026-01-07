import CoachProfile from "../models/CoachProfile.js";

export const getCoachProfile = async (req, res) => {
  try {
  const profile = await CoachProfile.findOne({
    userId: req.user.userId,
  });

  if (!profile) {
    return res.status(404).json({
      message: "Coach profile not found",
    });
  }

  return res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCoachProfile = async (req, res) => {
  const updated = await CoachProfile.findOneAndUpdate(
    { userId: req.user.userId },
    req.body,
    { new: true, runValidators: true }
  );

  res.json({
    message: "Coach profile updated",
    profile: updated,
  });
};
