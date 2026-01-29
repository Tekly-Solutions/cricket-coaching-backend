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

const app = express();

// CORS configuration for mobile apps
app.use(
  cors({
    origin: '*', // Allow all origins
    credentials: false,
  })
);

app.use(morgan("dev"));
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.send(`Server is running locally on http://localhost:${PORT}`);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/player", playerRouter);
app.use("/api/guardian", guardianRouter);
app.use("/api/sessions", sessionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/bookings", bookingRoutes);

export default app;
