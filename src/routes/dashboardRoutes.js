import express from 'express';
import { jwtAuth } from '../middlewares/jwtAuthMiddleware.js';
import { roleAuth } from '../middlewares/roleAuth.js';
import {
    getCoachDashboard,
    getPlayerDashboard,
    getGuardianDashboard,
} from '../controllers/dashboardController.js';

const router = express.Router();

// All dashboard routes require authentication
router.use(jwtAuth);

// Role-specific dashboard endpoints
router.get('/coach', roleAuth('coach'), getCoachDashboard);
router.get('/player', roleAuth('player'), getPlayerDashboard);
router.get('/guardian', roleAuth('guardian'), getGuardianDashboard);

export default router;
