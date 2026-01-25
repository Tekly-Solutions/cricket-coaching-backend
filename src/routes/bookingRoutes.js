import express from 'express';
const router = express.Router();
import {
    createBooking,
    getPlayerBookings,
    getBookingById,
    cancelBooking,
    validatePromoCode,
} from '../controllers/bookingController.js';
import { jwtAuth } from '../middlewares/jwtAuthMiddleware.js';

// Middleware to verify player or guardian role
const playerOrGuardianOnly = (req, res, next) => {
    if (req.user.role !== 'player' && req.user.role !== 'guardian') {
        return res.status(403).json({ message: 'Access restricted to players and guardians only' });
    }
    next();
};

// Routes
router.post('/validate-promo', jwtAuth, validatePromoCode);

router
    .route('/')
    .post(jwtAuth, playerOrGuardianOnly, createBooking)
    .get(jwtAuth, playerOrGuardianOnly, getPlayerBookings);

router.route('/:id').get(jwtAuth, getBookingById);

router.route('/:id/cancel').put(jwtAuth, playerOrGuardianOnly, cancelBooking);

export default router;
