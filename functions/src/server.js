import dotenv from "dotenv";
dotenv.config(); // Only for local dev

import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    await connectDB(process.env.MONGO_URI); // pass local .env value
    app.listen(PORT, () => {
      console.log(`Server running locally on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
