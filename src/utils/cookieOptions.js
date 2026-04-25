const cookieOptions = {
  adminToken: {
    httpOnly: true,                      // Prevents JS access (XSS protection)
    secure: true,                        // REQUIRED for SameSite=None
    sameSite: "none",                    // REQUIRED for cross-origin cookies
    maxAge: 60 * 60 * 1000,              // 1 hour (match token expiry)
    path: "/",                           // Available site-wide
  },
};

export default cookieOptions;