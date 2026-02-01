import admin from "../config/firebase.js";
import User from "../models/User.js";
import { verifyAccessToken } from "../utils/jwt.js";

/**
 * Hybrid authentication middleware that supports both:
 * 1. Firebase ID tokens (for new users)
 * 2. JWT access tokens (for existing/local users)
 */
export const hybridAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    // Try Firebase token first
    try {
      console.log("🔑 Attempting Firebase token verification...");
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log("✅ Firebase token verified for:", decodedToken.email);

      // Find user in MongoDB
      const user = await User.findOne({ firebaseUid: decodedToken.uid });

      if (user) {
        console.log("👤 User found via Firebase UID:", user.email, "Role:", user.role);
        req.user = {
          userId: user._id.toString(),
          id: user._id.toString(),
          firebaseUid: decodedToken.uid,
          email: decodedToken.email,
          role: user.role,
          fullName: user.fullName,
        };
        req.firebaseUser = decodedToken;
        return next();
      } else {
        console.log("⚠️ Firebase token valid but user not in MongoDB");
        return res.status(404).json({
          success: false,
          message: "User not found. Please complete signup.",
        });
      }

    } catch (firebaseError) {
      // Firebase verification failed, try JWT
      console.log("⚠️ Firebase verification failed:", firebaseError.message);
      console.log("⚠️ Trying JWT...");

      try {
        const decoded = verifyAccessToken(token);
        console.log("✅ JWT token verified for user ID:", decoded.userId);

        // Find user in MongoDB by ID
        const user = await User.findById(decoded.userId);

        if (!user) {
          console.log("❌ User not found for JWT userId:", decoded.userId);
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        console.log("👤 User found via JWT:", user.email, "Role:", user.role);
        req.user = {
          userId: user._id.toString(),
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          fullName: user.fullName,
        };
        return next();
      } catch (jwtError) {
        console.error("❌ Both Firebase and JWT verification failed");
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }
    }
  } catch (error) {
    console.error("❌ Hybrid auth error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};
