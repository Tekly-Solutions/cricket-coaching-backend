const cookieOptions = {
  adminToken: {
    httpOnly: true,                      // Prevents JS access (XSS protection)
    secure: process.env.NODE_ENV === "production", // HTTPS only in prod
    sameSite: "strict",                  // CSRF protection
    maxAge: 60 * 60 * 1000,              // 1 hour (match token expiry)
    path: "/",                           // Available site-wide
  },
};

export default cookieOptions;