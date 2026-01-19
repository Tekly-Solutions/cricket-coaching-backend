import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import coachRoutes from "./routes/coachRoutes.js";
import playerRouter from "./routes/playerRoutes.js";
import guardianRouter from "./routes/guardianRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";

const app = express();

const FRONTEND_URLS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",")
  : [];

const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: FRONTEND_URLS,
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`Server is running on http://localhost:${PORT}`);
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/player", playerRouter);
app.use("/api/guardian", guardianRouter);
app.use("/api/sessions", sessionRoutes);

export default app;
