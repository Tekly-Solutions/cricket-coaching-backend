import express from "express";
import rateLimit from "express-rate-limit";
import { continueWithProvider, login, refreshToken, signup, signupLocal, loginLocal, changePassword } from "../controllers/authController.js";
import { verifyFirebaseToken } from "../middlewares/firebaseAuth.js";
import { hybridAuth } from "../middlewares/hybridAuth.js";

const router = express.Router();

// Define auth rate limiter: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window`
  message: { message: "Too many login/signup attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiter to all auth routes
router.use(authLimiter);

router.post("/signup", verifyFirebaseToken, signup);
router.post("/register", signupLocal); // Local auth registration
router.post("/login", loginLocal); // Local auth login (Replaces Firebase login for now)
router.post("/continue-oauth", verifyFirebaseToken, continueWithProvider);

// Refresh token
router.post("/refresh-token", refreshToken);

// Change Password
router.post("/change-password", hybridAuth, changePassword);

export default router;
