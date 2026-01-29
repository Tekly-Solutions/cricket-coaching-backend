// routes/guardianRoutes.js
import express from "express";
import { jwtAuth } from "../middlewares/jwtAuthMiddleware.js";
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  getGuardianProfile,
  updateGuardianProfile,
  addPlayerToGuardian,     // ← existing (if you want to keep userId method)
  createAndAddPlayer,      // ← NEW: create player + link
  getMyPlayers,
} from "../controllers/guardianController.js";

const router = express.Router();

router.use(jwtAuth);

router.get("/profile", roleAuth("guardian"), getGuardianProfile);
router.put("/profile", roleAuth("guardian"), updateGuardianProfile);

// Option A: Keep old method (add existing player by userId)
router.post("/players/existing", roleAuth("guardian"), addPlayerToGuardian);

// Option B: NEW main method – create new player
router.post("/players", roleAuth("guardian"), createAndAddPlayer);

router.get("/players", roleAuth("guardian"), getMyPlayers);

export default router;