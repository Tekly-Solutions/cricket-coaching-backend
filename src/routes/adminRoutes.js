import express from "express";
import {
  adminLogin,
  adminLogout,
} from "../controllers/admin/authController.js";
import { adminAuth } from "../middlewares/adminAuth.js";
import { getAllCoaches, getAllGuardians, getCoachById, getGuardianById } from "../controllers/admin/userController.js";

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

export default router;