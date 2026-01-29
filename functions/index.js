import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";

// limit instances (cost control)
setGlobalOptions({ maxInstances: 10 });

// define secret
const MONGO_URI = defineSecret("MONGO_URI");
export const JWT_SECRET = defineSecret("JWT_SECRET");
export const JWT_ACCESS_SECRET = defineSecret("JWT_ACCESS_SECRET");
export const JWT_REFRESH_SECRET = defineSecret("JWT_REFRESH_SECRET");

// connect DB once on cold start
let isConnected = false;

async function initDB() {
  if (isConnected) return;

//   await connectDB(process.env.MONGO_URI);
await connectDB(MONGO_URI.value());
  isConnected = true;
  console.log("MongoDB connected");
}

// export API
export const api = onRequest(
  {
    secrets: [MONGO_URI],
  },
  async (req, res) => {
    await initDB();
    return app(req, res);
  }
);
