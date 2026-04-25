import express from 'express';
import { hybridAuth } from '../middlewares/hybridAuth.js';
import {
    createOrGetCustomer,
    createSetupIntent,
    listPaymentMethods,
    deletePaymentMethod,
    chargeBooking,
    refundBooking,
    connectOnboard,
    getConnectStatus,
    createSubscription,
    cancelSubscription,
    getSubscriptionStatus,
    changeSubscriptionPlan,
    handleWebhook,
} from '../controllers/paymentController.js';

const router = express.Router();

// Webhook has been moved to app.js to bypass express.json()

// ── Customer ─────────────────────────────────────────────────────────────────
router.post('/customer/create-or-get', hybridAuth, createOrGetCustomer);

// ── Saved Cards ───────────────────────────────────────────────────────────────
router.post('/setup-intent', hybridAuth, createSetupIntent);
router.get('/payment-methods', hybridAuth, listPaymentMethods);
router.delete('/payment-methods/:pmId', hybridAuth, deletePaymentMethod);

// ── Booking Charge & Refund ───────────────────────────────────────────────────
router.post('/charge-booking', hybridAuth, chargeBooking);
router.post('/refund', hybridAuth, refundBooking);

// ── Stripe Connect (Coach Payouts) ────────────────────────────────────────────
router.post('/connect/onboard', hybridAuth, connectOnboard);
router.get('/connect/status', hybridAuth, getConnectStatus);

// ── Subscriptions ─────────────────────────────────────────────────────────────
router.post('/subscription/create', hybridAuth, createSubscription);
router.post('/subscription/cancel', hybridAuth, cancelSubscription);
router.get('/subscription/status', hybridAuth, getSubscriptionStatus);
router.post('/subscription/change-plan', hybridAuth, changeSubscriptionPlan);

export default router;
