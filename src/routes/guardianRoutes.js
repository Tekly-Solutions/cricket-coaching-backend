// routes/guardianRoutes.js
import express from "express";
import { hybridAuth } from '../middlewares/hybridAuth.js';
import { roleAuth } from "../middlewares/roleAuth.js";
import {
  getGuardianProfile,
  updateGuardianProfile,
  addPlayerToGuardian,     // ← existing (if you want to keep userId method)
  createAndAddPlayer,      // ← NEW: create player + link
  getMyPlayers,
  getPlayerDetails,
  removePlayer,
  updatePlayer,
} from "../controllers/guardianController.js";

const router = express.Router();

router.use(hybridAuth);

router.get("/profile", roleAuth("guardian"), getGuardianProfile);
router.put("/profile", roleAuth("guardian"), updateGuardianProfile);

// Option A: Keep old method (add existing player by userId)
router.post("/players/existing", roleAuth("guardian"), addPlayerToGuardian);

// Option B: NEW main method – create new player
router.post("/players", roleAuth("guardian"), createAndAddPlayer);

router.get("/players", roleAuth("guardian"), getMyPlayers);
router.get("/player/:id", roleAuth("guardian"), getPlayerDetails);
router.put("/player/:id", roleAuth("guardian"), updatePlayer);
router.delete("/player/:id", roleAuth("guardian"), removePlayer);

export default router;