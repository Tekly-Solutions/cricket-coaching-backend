import express from 'express';
const router = express.Router();
import {
    createBooking,
    getPlayerBookings,
    getBookingById,
    cancelBooking,
    validatePromoCode,
} from '../controllers/bookingController.js';
import { hybridAuth } from '../middlewares/hybridAuth.js';

// Middleware to verify player or guardian role
const playerOrGuardianOnly = (req, res, next) => {
    if (req.user.role !== 'player' && req.user.role !== 'guardian') {
        return res.status(403).json({ message: 'Access restricted to players and guardians only' });
    }
    next();
};

// Routes
router.post('/validate-promo', hybridAuth, validatePromoCode);

router
    .route('/')
    .post(hybridAuth, playerOrGuardianOnly, createBooking)
    .get(hybridAuth, playerOrGuardianOnly, getPlayerBookings);

router.route('/:id').get(hybridAuth, getBookingById);

router.route('/:id/cancel').put(hybridAuth, playerOrGuardianOnly, cancelBooking);

export default router;
