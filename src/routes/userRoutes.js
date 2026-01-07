import express from "express";
import { jwtAuth } from "../middlewares/jwtAuthMiddleware.js";
import { getUserProfile, updateUserProfile } from "../controllers/userController.js";

const router = express.Router();

// Get own profile
router.get("/me", jwtAuth, getUserProfile);

// Update own profile
router.put("/me", jwtAuth, updateUserProfile);

export default router;
