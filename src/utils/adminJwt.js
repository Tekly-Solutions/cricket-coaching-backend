import jwt from "jsonwebtoken";

const ADMIN_ACCESS_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_ACCESS_EXPIRY = process.env.ADMIN_JWT_EXPIRY; // short-lived

export const signAdminAccessToken = (payload) => {
  return jwt.sign(payload, ADMIN_ACCESS_SECRET, {
    expiresIn: ADMIN_ACCESS_EXPIRY,
  });
};

export const verifyAdminAccessToken = (token) => {
  return jwt.verify(token, ADMIN_ACCESS_SECRET);
};