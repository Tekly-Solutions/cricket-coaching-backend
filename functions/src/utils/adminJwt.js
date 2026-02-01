import jwt from "jsonwebtoken";
import {
  ADMIN_JWT_SECRET,
} from "../config/secrets.js";

export const signAdminAccessToken = (payload) => {
  return jwt.sign(payload, ADMIN_JWT_SECRET.value(), {
    expiresIn: "4h",
  });
};

export const verifyAdminAccessToken = (token) => {
  return jwt.verify(token, ADMIN_JWT_SECRET.value());
};