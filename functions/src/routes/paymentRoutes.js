import express from 'express';
import { createPaymentIntent } from '../controllers/paymentController.js';
// Add authentication middleware if needed
// import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/create-payment-intent', createPaymentIntent);

export default router;
