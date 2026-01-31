import express from "express";
import { hybridAuth } from "../middlewares/hybridAuth.js";
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
  hybridAuth,
  roleAuth("coach"),
  getCoachProfile
);

router.put(
  "/profile",
  hybridAuth,
  roleAuth("coach"),
  updateCoachProfile
);

router.get(
  "/players",
  hybridAuth,
  roleAuth("coach"),
  getCoachPlayers
);

router.get(
  "/availability",
  hybridAuth,
  roleAuth("coach"),
  getCoachAvailability
);

router.put(
  "/availability",
  hybridAuth,
  roleAuth("coach"),
  updateCoachAvailability
);

router.post(
  "/availability/blocked-date",
  hybridAuth,
  roleAuth("coach"),
  addBlockedDate
);

router.delete(
  "/availability/blocked-date/:id",
  hybridAuth,
  roleAuth("coach"),
  removeBlockedDate
);

export default router;