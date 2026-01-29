import { onRequest } from "firebase-functions/v1/https"; // v1 HTTP function
import { setGlobalOptions } from "firebase-functions";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";

// Optional: limit max instances to control cost
setGlobalOptions({ maxInstances: 10 });

const MONGO_URI = defineSecret("MONGO_URI");

// Connect to MongoDB once at cold start
const startServer = async () => {
  try {
    await connectDB(
      process.env.MONGO_URI || process.env.MONGO_URI_FIREBASE // Firebase config will override this
    );
    console.log("Database connected!");
  } catch (error) {
    console.error("DB connection failed:", error);
  }
};
startServer();

// Export Express app as HTTPS Firebase function
export const api = onRequest(
    {
        secrets: [MONGO_URI],
    },
    app
);
