import express from "express";
import {
  adminLogin,
  adminLogout,
  getAdminMe,
} from "../controllers/admin/authController.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import { getAllCoaches, getAllGuardians, getAllPlayers, getCoachById, getGuardianById, getPlayerById } from "../controllers/admin/userController.js";
import { getBookingById } from "../controllers/bookingController.js";
import { deleteBooking, getAllBookings, getBookingByIdAdmin, getBookingStats, getUserBookingsAdmin, updateBookingStatus } from "../controllers/admin/bookingController.js";
import { getCoachRecentSessionsAdmin, getCoachSessionsAdmin } from "../controllers/admin/sessionController.js";
import { getGuardianBookings, getGuardianRecentBookings } from "../controllers/admin/guardianController.js";
import { getPlayerRecentBookings } from "../controllers/admin/playerController.js";
import { createPlan, deletePlan, getAllPlans, getSubscriptionStats, updatePlan } from "../controllers/admin/subscriptionController.js";
import { 
  createPromoCode, 
  deletePromoCode, 
  getAllPromoCodes, 
  getPromoCodeById, 
  getPromoCodeStats, 
  updatePromoCode, 
  updatePromoCodeStatus, 
  validatePromoCode 
} from "../controllers/admin/promoCodeController.js";
import { getDashboardOverview } from "../controllers/admin/dashboardController.js";
import { 
  addSportCommission, 
  addUserOverride, 
  calculateCommission, 
  deleteSportCommission, 
  deleteUserOverride, 
  getCommissionSettings, 
  updateGlobalRate, 
  updateSportCommission, 
  updateUserOverride 
} from "../controllers/admin/commissionController.js";

// Example protected route (add more later: users, sessions, reports, etc.)
// import { getAdminDashboard } from "../controllers/admin/dashboardController.js"; // create later

const router = express.Router();

// Public routes
router.post("/login", adminLogin);
router.post("/logout", adminLogout);

router.get("/me", adminAuth, getAdminMe);

// Protected admin routes
// router.use(adminAuth);

// router.get("/dashboard", getAdminDashboard); // example

/* coaches */
router.get("/coaches", adminAuth, getAllCoaches); // get all coaches with filters
router.get("/coaches/:id", adminAuth, getCoachById); // Get single coach by ID

// Coach sessions
router.get("/coaches/:id/sessions", adminAuth, getCoachSessionsAdmin);
router.get("/coaches/:id/sessions/recent", adminAuth, getCoachRecentSessionsAdmin);

// Guardians
router.get("/guardians", adminAuth, getAllGuardians); // get all guardians with filters
router.get("/guardians/:id", adminAuth, getGuardianById); // Get single guardian by ID
router.get("/guardians/:id/bookings", adminAuth, getGuardianBookings);
router.get("/guardians/:id/bookings/recent", adminAuth, getGuardianRecentBookings);


// Players
router.get("/players", adminAuth, getAllPlayers);
router.get("/players/:id", adminAuth, getPlayerById);
router.get("/players/:id/bookings/recent", adminAuth, getPlayerRecentBookings);

// Bookings
router.get("/bookings/stats", adminAuth, getBookingStats); // Booking stats for admin dashboard
router.get("/bookings", adminAuth, getAllBookings);                    // All bookings + filters
router.get("/bookings/:id", adminAuth, getBookingByIdAdmin);           // Single booking details
router.get("/bookings/user/:userId", adminAuth, getUserBookingsAdmin); // Bookings for specific user
router.patch("/bookings/:id/status", adminAuth, updateBookingStatus);
router.delete("/bookings/:id", adminAuth, deleteBooking);

// Subscription Plans
router.get("/subscriptions/stats", adminAuth, getSubscriptionStats);
router.get("/subscriptions/plans", adminAuth, getAllPlans);
router.post("/subscriptions/plans", adminAuth, createPlan);
router.put("/subscriptions/plans/:id", adminAuth, updatePlan);
router.delete("/subscriptions/plans/:id", adminAuth, deletePlan);

// Promo Codes
router.get("/promo-codes/stats", adminAuth, getPromoCodeStats);        // Get promo code statistics
router.get("/promo-codes", adminAuth, getAllPromoCodes);               // Get all promo codes with filters
router.get("/promo-codes/:id", adminAuth, getPromoCodeById);           // Get single promo code
router.post("/promo-codes", adminAuth, createPromoCode);               // Create new promo code
router.put("/promo-codes/:id", adminAuth, updatePromoCode);            // Update promo code
router.patch("/promo-codes/:id/status", adminAuth, updatePromoCodeStatus); // Change status
router.delete("/promo-codes/:id", adminAuth, deletePromoCode);         // Delete promo code
router.post("/promo-codes/validate", adminAuth, validatePromoCode);    // Validate promo code

// Dashboard overview
router.get("/dashboard/overview", adminAuth, getDashboardOverview); // Admin dashboard overview stats

// Commission Settings
router.get("/commission/settings", adminAuth, getCommissionSettings);           // Get current commission settings
router.put("/commission/global-rate", adminAuth, updateGlobalRate);             // Update global commission rate
router.post("/commission/sport-rates", adminAuth, addSportCommission);          // Add sport-specific rate
router.put("/commission/sport-rates/:sportId", adminAuth, updateSportCommission); // Update sport-specific rate
router.delete("/commission/sport-rates/:sportId", adminAuth, deleteSportCommission); // Delete sport-specific rate
router.post("/commission/user-overrides", adminAuth, addUserOverride);          // Add user-specific override
router.put("/commission/user-overrides/:overrideId", adminAuth, updateUserOverride); // Update user-specific override
router.delete("/commission/user-overrides/:overrideId", adminAuth, deleteUserOverride); // Delete user-specific override
router.get("/commission/calculate", adminAuth, calculateCommission);            // Calculate commission for a booking



export default router;