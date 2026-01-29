import express from "express";
import { jwtAuth } from "../middlewares/jwtAuthMiddleware.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  getCoachProfile,
  updateCoachProfile,
} from "../controllers/coachController.js";

const router = express.Router();

router.get(
  "/profile",
  jwtAuth,
  roleAuth("coach"),
  getCoachProfile
);

router.put(
  "/profile",
  jwtAuth,
  roleAuth("coach"),
  updateCoachProfile
);

export default router;