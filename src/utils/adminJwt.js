import jwt from "jsonwebtoken";

// const ADMIN_ACCESS_SECRET = process.env.ADMIN_JWT_SECRET;
// const ADMIN_ACCESS_EXPIRY = process.env.ADMIN_JWT_EXPIRY; // short-lived

// console.log("ADMIN_JWT_SECRET:", process.env.ADMIN_JWT_SECRET || "undefined");


export const signAdminAccessToken = (payload) => {
  return jwt.sign(payload, process.env.ADMIN_JWT_SECRET, {
    expiresIn: process.env.ADMIN_JWT_EXPIRY || "4h",
  });
};

export const verifyAdminAccessToken = (token) => {
  return jwt.verify(token, process.env.ADMIN_JWT_SECRET);
};