import { verifyJwt } from "../utils/jwt.js";

export const jwtAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,             
        message: "No token provided"
    });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyJwt(token);

    req.user = decoded; // { userId, role }
    next();
  } catch (error) {
    console.error("JWT Auth error:", error);
    return res.status(401).json({
        success: false,
        message: "Invalid or expired token"
    });
  }
};
