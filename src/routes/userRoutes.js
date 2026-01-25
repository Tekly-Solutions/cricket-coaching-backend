import express from "express";
import { jwtAuth } from "../middlewares/jwtAuthMiddleware.js";
import { getUserProfile, updateUserProfile } from "../controllers/userController.js";
import { getProfile, updateProfile, updateProfileImage } from "../controllers/profileController.js";

const router = express.Router();

// Get own profile
router.get("/me", jwtAuth, getUserProfile);

// Update own profile
router.put("/me", jwtAuth, updateUserProfile);

// Profile management endpoints
router.get("/profile", jwtAuth, getProfile);
router.put("/profile", jwtAuth, updateProfile);
router.put("/profile/image", jwtAuth, updateProfileImage);

export default router;
