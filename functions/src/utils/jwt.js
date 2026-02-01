import jwt from "jsonwebtoken";
import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
} from "../config/secrets.js";

export const signAccessToken = (payload) => {
  return jwt.sign(payload, JWT_ACCESS_SECRET.value(), {
    expiresIn: '4h',
  });
};

export const signRefreshToken = (payload) => {
  return jwt.sign(payload, JWT_REFRESH_SECRET.value(), {
    expiresIn: '30d',
  });
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_ACCESS_SECRET.value());
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET.value());
};