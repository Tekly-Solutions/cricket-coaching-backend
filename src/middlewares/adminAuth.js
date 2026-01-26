import { verifyAdminAccessToken } from "../utils/adminJwt.js";

export const adminAuth = async (req, res, next) => {
  try {
    // Read token from HTTP-only cookie
    const token = req.cookies.adminToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required (no token)",
      });
    }

    const decoded = verifyAdminAccessToken(token);

    if (decoded.role !== "admin" && decoded.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Insufficient admin privileges",
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    console.error("Admin auth error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin token",
    });
  }
};