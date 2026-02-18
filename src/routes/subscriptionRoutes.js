
import express from 'express';
import { getActivePlans } from '../controllers/subscriptionController.js';
// import { authenticateToken } from '../middlewares/authMiddleware.js'; // Optional: if we want to restrict to logged-in users

const router = express.Router();

// Public route to get active plans
router.get('/plans', getActivePlans);

export default router;
