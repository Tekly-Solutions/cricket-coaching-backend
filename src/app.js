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
import adminRouter from "./routes/adminRoutes.js";
import cookieParser from "cookie-parser";
import paymentRoutes from "./routes/paymentRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import commissionRoutes from "./routes/commissionRoutes.js";
import { handleWebhook } from "./controllers/paymentController.js";


const app = express();

// Enable cookie parsing (must come before routes)
app.use(cookieParser()); // IMPORTANT for req.cookies

// CORS configuration for both web and mobile apps
const allowedOrigins = [
  'http://localhost:5173',           // Vite dev server
  'http://localhost:3000',           // Alternative dev port
  'https://burl-ad60f.web.app',      // Production Firebase Hosting
  'https://burl-ad60f.firebaseapp.com', // Alternative Firebase Hosting
  // Mobile apps don't send Origin header, so we handle them separately
];

// CORS configuration for mobile apps
// Mobile apps don't have a specific origin, so we need to allow all
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }

      // Check if the origin is in our allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject other origins
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

const PORT = process.env.PORT || 4000;

app.use(morgan("dev"));

// ── Webhook (raw body — MUST be before any JSON body-parser routes) ──────────
app.post("/api/payments/webhook", express.raw({ type: 'application/json' }), handleWebhook);

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
app.use("/api/reviews", reviewRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/commission", commissionRoutes);


/* Admin routes */
app.use("/api/admin", adminRouter);

export default app;
