import { defineSecret } from "firebase-functions/params";

export const MONGO_URI = defineSecret("MONGO_URI");
export const JWT_ACCESS_SECRET = defineSecret("JWT_ACCESS_SECRET");
export const JWT_REFRESH_SECRET = defineSecret("JWT_REFRESH_SECRET");
