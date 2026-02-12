import express from 'express';
const router = express.Router();
import {
    createBooking,
    createPrivateBooking,
    getPlayerBookings,
    getBookingById,
    cancelBooking,

    validatePromoCode,
    getCoachBookings,
    updateBookingStatus,
} from '../controllers/bookingController.js';
import { roleAuth } from '../middlewares/roleAuth.js';
import { hybridAuth } from '../middlewares/hybridAuth.js';

// Middleware to verify player or guardian role
const playerOrGuardianOnly = (req, res, next) => {
    if (req.user.role !== 'player' && req.user.role !== 'guardian') {
        return res.status(403).json({ message: 'Access restricted to players and guardians only' });
    }
    next();
};

const logRequest = (req, res, next) => {
    console.log('--- Request Debug ---');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('User:', req.user);
    console.log('---------------------');
    next();
};

// Routes
router.post('/validate-promo', hybridAuth, validatePromoCode);
router.post('/private', hybridAuth, playerOrGuardianOnly, logRequest, createPrivateBooking);

// Coach Routes
router.get('/coach', hybridAuth, roleAuth('coach'), getCoachBookings);
router.put('/:id/status', hybridAuth, roleAuth('coach'), updateBookingStatus);

router
    .route('/')
    .post(hybridAuth, playerOrGuardianOnly, createBooking)
    .get(hybridAuth, playerOrGuardianOnly, getPlayerBookings);

router.route('/:id').get(hybridAuth, getBookingById);

router.route('/:id/cancel').put(hybridAuth, cancelBooking); // Accessible by player/guardian

export default router;