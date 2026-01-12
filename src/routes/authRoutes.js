import express from "express";
import { continueWithProvider, login, refreshToken, signup } from "../controllers/authController.js";
import { verifyFirebaseToken } from "../middlewares/firebaseAuth.js";

const router = express.Router();

router.post("/signup", verifyFirebaseToken, signup);
router.post("/login", verifyFirebaseToken, login);
router.post("/continue-oauth", verifyFirebaseToken, continueWithProvider);

// Refresh token
router.post("/refresh-token", refreshToken);

export default router;
