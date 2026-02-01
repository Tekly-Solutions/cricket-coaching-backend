import {
  NODE_ENV,
} from "../config/secrets.js";

const cookieOptions = {
  adminToken: {
    httpOnly: true,                      // Prevents JS access (XSS protection)
    secure: NODE_ENV.value() === "production", // HTTPS only in prod
    sameSite: "strict",                  // CSRF protection
    maxAge: 60 * 60 * 1000,              // 1 hour (match token expiry)
    path: "/",                           // Available site-wide
  },
};

export default cookieOptions;