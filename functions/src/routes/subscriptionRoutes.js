
import express from 'express';
import { getActivePlans, activateSubscription } from '../controllers/subscriptionController.js';
import { hybridAuth } from '../middlewares/hybridAuth.js';

const router = express.Router();

// Public route to get active plans
router.get('/plans', getActivePlans);

// Authenticated route to activate a subscription
router.post('/activate', hybridAuth, activateSubscription);

export default router;
