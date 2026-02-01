// import dotenv from "dotenv";
// dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import coachRoutes from "./routes/coachRoutes.js";
import playerRouter from "./routes/playerRoutes.js";
import guardianRouter from "./routes/guardianRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import earningsRoutes from "./routes/earnings.js";
import notificationRoutes from "./routes/notifications.js";
import searchRoutes from "./routes/searchRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import cookieParser from "cookie-parser";

const app = express();

// Enable cookie parsing (must come before routes)
app.use(cookieParser()); // IMPORTANT for req.cookies

// CORS configuration for mobile apps
// Mobile apps don't have a specific origin, so we need to allow all
app.use(
  cors({
    origin: 'http://localhost:5173', // Allow all origins for mobile apps
    credentials: true, // needed for cookies
  })
);

const PORT = process.env.PORT || 4000;

app.use(morgan("dev"));

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
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/earnings", earningsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/search", searchRoutes);

/* Admin routes */
app.use("/api/admin", adminRouter);

export default app;
