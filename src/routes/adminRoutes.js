import express from "express";
import {
  adminLogin,
  adminLogout,
} from "../controllers/admin/authController.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import { getAllCoaches, getAllGuardians, getAllPlayers, getCoachById, getGuardianById, getPlayerById } from "../controllers/admin/userController.js";
import { getBookingById } from "../controllers/bookingController.js";
import { getAllBookings, getBookingByIdAdmin, getBookingStats, getUserBookingsAdmin } from "../controllers/admin/bookingController.js";

// Example protected route (add more later: users, sessions, reports, etc.)
// import { getAdminDashboard } from "../controllers/admin/dashboardController.js"; // create later

const router = express.Router();

// Public routes
router.post("/login", adminLogin);
router.post("/logout", adminLogout); // optional

// Protected admin routes
// router.use(adminAuth);

// router.get("/dashboard", getAdminDashboard); // example

/* coaches */
router.get("/coaches", adminAuth, getAllCoaches); // get all coaches with filters
router.get("/coaches/:id", adminAuth, getCoachById); // Get single coach by ID

// Guardians
router.get("/guardians", adminAuth, getAllGuardians); // get all guardians with filters
router.get("/guardians/:id", adminAuth, getGuardianById); // Get single guardian by ID


// Players
router.get("/players", adminAuth, getAllPlayers);
router.get("/players/:id", adminAuth, getPlayerById);

// Bookings
router.get("/bookings/stats", adminAuth, getBookingStats); // Booking stats for admin dashboard
router.get("/bookings", adminAuth, getAllBookings);                    // All bookings + filters
router.get("/bookings/:id", adminAuth, getBookingByIdAdmin);           // Single booking details
router.get("/bookings/user/:userId", adminAuth, getUserBookingsAdmin); // Bookings for specific user



export default router;