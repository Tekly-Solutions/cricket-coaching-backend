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
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/coach", coachRoutes);
app.use("/player", playerRouter);
app.use("/guardian", guardianRouter);
app.use("/sessions", sessionRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/bookings", bookingRoutes);

export default app;
