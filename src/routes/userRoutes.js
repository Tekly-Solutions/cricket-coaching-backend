import express from "express";
import { hybridAuth } from "../middlewares/hybridAuth.js";
import { getUserProfile, updateUserProfile, deleteAccount } from "../controllers/userController.js";
import { getProfile, updateProfile, updateProfileImage } from "../controllers/profileController.js";

const router = express.Router();

// Get own profile
router.get("/me", hybridAuth, getUserProfile);

// Update own profile
router.put("/me", hybridAuth, updateUserProfile);

// Delete own account
router.delete("/me", hybridAuth, deleteAccount);

// Profile management endpoints
router.get("/profile", hybridAuth, getProfile);
router.put("/profile", hybridAuth, updateProfile);
router.put("/profile/image", hybridAuth, updateProfileImage);

export default router;
