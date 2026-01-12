import { verifyAccessToken } from "../utils/jwt.js";

export const jwtAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify ACCESS token only
    const decoded = verifyAccessToken(token);

    // decoded = { userId, role, iat, exp }
    req.user = decoded;

    next();
  } catch (error) {
    console.error("JWT Auth error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
};
