import dotenv from "dotenv";
dotenv.config();

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
import paymentRoutes from "./routes/paymentRoutes.js";


const app = express();

// CORS configuration for mobile apps
// Mobile apps don't have a specific origin, so we need to allow all
app.use(
  cors({
    origin: '*', // Allow all origins for mobile apps
    credentials: false, // Set to false when using origin: '*'
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
app.use("/api/payments", paymentRoutes);


export default app;
