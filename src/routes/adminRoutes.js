import express from "express";
import {
  adminLogin,
  adminLogout,
} from "../controllers/admin/authController.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import { getAllCoaches, getCoachById } from "../controllers/admin/coachController.js";

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
router.get("/coaches", adminAuth, getAllCoaches);

// Get single coach by ID
router.get("/coaches/:id", adminAuth, getCoachById);

export default router;