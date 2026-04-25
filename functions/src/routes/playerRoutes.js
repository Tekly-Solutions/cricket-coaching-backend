import express from "express";
import { hybridAuth } from '../middlewares/hybridAuth.js';
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  getPlayerProfile,
  updatePlayerProfile,
} from "../controllers/playerController.js";

const router = express.Router();

// All player routes require authentication
router.use(hybridAuth);

// Only players can access their own profile
router.get(
  "/profile",
  roleAuth("player"),
  getPlayerProfile
);

router.put(
  "/profile",
  roleAuth("player"),
  updatePlayerProfile
);

export default router;