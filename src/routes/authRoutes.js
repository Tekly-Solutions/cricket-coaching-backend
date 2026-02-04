import express from "express";
import { continueWithProvider, login, refreshToken, signup, signupLocal, loginLocal, changePassword } from "../controllers/authController.js";
import { verifyFirebaseToken } from "../middlewares/firebaseAuth.js";
import { hybridAuth } from "../middlewares/hybridAuth.js";

const router = express.Router();

router.post("/signup", verifyFirebaseToken, signup);
router.post("/register", signupLocal); // Local auth registration
router.post("/login", loginLocal); // Local auth login (Replaces Firebase login for now)
router.post("/continue-oauth", verifyFirebaseToken, continueWithProvider);

// Refresh token
router.post("/refresh-token", refreshToken);

// Change Password
router.post("/change-password", hybridAuth, changePassword);

export default router;
