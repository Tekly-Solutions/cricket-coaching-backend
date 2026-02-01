export const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";

  return {
    adminToken: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "strict",
      maxAge: 60 * 60 * 1000,
      path: "/",
    },
  };
};
