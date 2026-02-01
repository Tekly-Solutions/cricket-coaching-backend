import { defineSecret } from "firebase-functions/params";

export const MONGO_URI = defineSecret("MONGO_URI");
export const JWT_ACCESS_SECRET = defineSecret("JWT_ACCESS_SECRET");
export const JWT_REFRESH_SECRET = defineSecret("JWT_REFRESH_SECRET");
export const ADMIN_JWT_SECRET = defineSecret("ADMIN_JWT_SECRET");
export const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
export const NODE_ENV = defineSecret("NODE_ENV");
