import admin from "../config/firebase.js";
import User from "../models/User.js";

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ Missing or invalid authorization header");
      return res.status(401).json({ message: "Missing token" });
    }

    const idToken = authHeader.split(" ")[1];
    console.log("🔑 Verifying Firebase token...");
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log("✅ Token verified for user:", decodedToken.email);
    
    // Find user in MongoDB and attach to request
    const user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (user) {
      console.log("👤 User found in MongoDB:", user.email, "Role:", user.role);
      req.user = {
        id: user._id.toString(),
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        role: user.role,
        fullName: user.fullName,
      };
    } else {
      console.log("⚠️ User not found in MongoDB for Firebase UID:", decodedToken.uid);
    }

    req.firebaseUser = decodedToken; // uid, email
    next();
  } catch (error) {
    console.error("❌ Firebase token verification error:", error.message);
    return res.status(401).json({ message: "Invalid Firebase token" });
  }
};
