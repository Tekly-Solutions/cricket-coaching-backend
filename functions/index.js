import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import {
  MONGO_URI,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
} from "./src/config/secrets.js";

setGlobalOptions({ maxInstances: 10 });

let isConnected = false;

async function initDB() {
  if (isConnected) return;
  await connectDB(MONGO_URI.value());
  isConnected = true;
}

export const api = onRequest(
  {
    secrets: [
      MONGO_URI,
      JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET,
    ],
  },
  async (req, res) => {
    await initDB();
    return app(req, res);
  }
);
