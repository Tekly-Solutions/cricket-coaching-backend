import express from "express";
import { jwtAuth } from "../middlewares/jwtAuthMiddleware.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  getCoachProfile,
  updateCoachProfile,
  getCoachPlayers,
  getCoachAvailability,
  updateCoachAvailability,
  addBlockedDate,
  removeBlockedDate,
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

router.get(
  "/players",
  jwtAuth,
  roleAuth("coach"),
  getCoachPlayers
);

router.get(
  "/availability",
  jwtAuth,
  roleAuth("coach"),
  getCoachAvailability
);

router.put(
  "/availability",
  jwtAuth,
  roleAuth("coach"),
  updateCoachAvailability
);

router.post(
  "/availability/blocked-date",
  jwtAuth,
  roleAuth("coach"),
  addBlockedDate
);

router.delete(
  "/availability/blocked-date/:id",
  jwtAuth,
  roleAuth("coach"),
  removeBlockedDate
);

export default router;