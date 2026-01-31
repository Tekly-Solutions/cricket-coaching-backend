import express from 'express';
import { hybridAuth } from '../middlewares/hybridAuth.js';
import { roleAuth } from '../middlewares/roleAuth.js';
import {
    getCoachDashboard,
    getPlayerDashboard,
    getGuardianDashboard,
} from '../controllers/dashboardController.js';

const router = express.Router();

// All dashboard routes require authentication (supports both Firebase and JWT)
router.use(hybridAuth);

// Role-specific dashboard endpoints
router.get('/coach', roleAuth('coach'), getCoachDashboard);
router.get('/player', roleAuth('player'), getPlayerDashboard);
router.get('/guardian', roleAuth('guardian'), getGuardianDashboard);

export default router;
