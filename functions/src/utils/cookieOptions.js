import { NODE_ENV } from "../config/secrets.js";

export const getCookieOptions = () => {
  const isProd = NODE_ENV.value() === "production";

  return {
    adminToken: {
      httpOnly: true,
      secure: isProd,          // HTTPS only in prod
      sameSite: isProd ? "none" : "strict",
      maxAge: 60 * 60 * 1000,  // 1 hour
      path: "/",
    },
  };
};
