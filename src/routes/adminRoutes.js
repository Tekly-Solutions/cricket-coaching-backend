import express from "express";
import {
  adminLogin,
  adminLogout,
} from "../controllers/admin/authController.js";
import { adminAuth } from "../middlewares/adminAuth.js";

// Example protected route (add more later: users, sessions, reports, etc.)
// import { getAdminDashboard } from "../controllers/admin/dashboardController.js"; // create later

const router = express.Router();

// Public routes
router.post("/login", adminLogin);
router.post("/logout", adminLogout); // optional

// Protected admin routes
router.use(adminAuth);

// router.get("/dashboard", getAdminDashboard); // example

export default router;