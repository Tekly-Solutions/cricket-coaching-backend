import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Session from '../models/Session.js';
import Notification from '../models/Notification.js';

// Mock promo codes (in production, these would come from a database)
const PROMO_CODES = {
    SUMMER10: { discount: 10.00, type: 'fixed' },
    CRICKET50: { discount: 30.00, type: 'fixed' }, // 50% of $60
};

/**
 * Create a new booking
 * POST /api/bookings
 */
export const createBooking = async (req, res) => {
    try {
        const { sessionId, occurrenceDate, paymentMethod, promoCode } = req.body;
        const playerId = req.user._id;

        // Validate required fields
        if (!sessionId || !occurrenceDate || !paymentMethod) {
            return res.status(400).json({
                message: 'Session ID, occurrence date, and payment method are required',
            });
        }

        // Check if session exists
        const session = await Session.findById(sessionId).populate('coach', 'fullName');
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Verify the occurrence date is valid for this session
        const requestedDate = new Date(occurrenceDate);
        const isValidOccurrence = session.occurrences.some(
            (occ) => new Date(occ.date).getTime() === requestedDate.getTime()
        );

        if (!isValidOccurrence) {
            return res.status(400).json({
                message: 'Invalid occurrence date for this session',
            });
        }

        // Check if player has already booked this occurrence
        const existingBooking = await Booking.findOne({
            player: playerId,
            session: sessionId,
            occurrenceDate: requestedDate,
            status: { $in: ['pending', 'confirmed'] },
        });

        if (existingBooking) {
            return res.status(400).json({
                message: 'You have already booked this session',
            });
        }

        // Calculate pricing
        const sessionFee = 60.00; // Base fee (could be from session.price in future)
        const serviceFee = 2.50;
        const tax = 0.00;
        let discount = 0.00;

        // Apply promo code if provided
        if (promoCode) {
            const promo = PROMO_CODES[promoCode.toUpperCase()];
            if (promo) {
                discount = promo.discount;
            }
        }

        const total = sessionFee + serviceFee + tax - discount;

        // Create booking
        const booking = new Booking({
            player: playerId,
            session: sessionId,
            occurrenceDate: requestedDate,
            paymentMethod,
            pricing: {
                sessionFee,
                serviceFee,
                tax,
                discount,
                total,
            },
            promoCode: promoCode?.toUpperCase(),
            status: 'confirmed',
        });

        await booking.save();

        // Populate booking with session and coach details
        await booking.populate([
            {
                path: 'session',
                select: 'title location coach',
                populate: { path: 'coach', select: 'fullName' },
            },
            { path: 'player', select: 'fullName email' },
        ]);

        // Create notification for the coach
        try {
            await Notification.create({
                recipient: session.coach._id,
                sender: playerId,
                type: 'booking_confirmed',
                category: 'Schedule',
                title: 'New Booking Confirmed',
                description: `${booking.player.fullName} has booked your session "${session.title}" on ${requestedDate.toLocaleDateString()}`,
                priority: 'high',
                relatedEntity: {
                    entityType: 'Booking',
                    entityId: booking._id,
                },
            });
        } catch (notifError) {
            console.error('Failed to create notification:', notifError);
            // Don't fail the booking if notification fails
        }

        res.status(201).json({
            message: 'Booking created successfully',
            booking,
        });
    } catch (error) {
        console.error('Create booking error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get player's bookings
 * GET /api/bookings?type=upcoming|past|all&limit=10&page=1
 */
export const getPlayerBookings = async (req, res) => {
    try {
        const userId = req.user.userId;
        const userRole = req.user.role;
        const { type = 'all', limit = 10, page = 1 } = req.query;

        let query = {};

        // If player, show their bookings
        // If guardian, show bookings for all their players
        if (userRole === 'player') {
            query.player = userId;
        } else if (userRole === 'guardian') {
            // Find all players associated with this guardian
            const User = mongoose.model('User');
            const players = await User.find({ guardian: userId }).select('_id');
            const playerIds = players.map(p => p._id);
            query.player = { $in: playerIds };
        } else {
            // If somehow a coach tries to access, return empty
            return res.json({
                bookings: [],
                pagination: { total: 0, page: 1, limit: parseInt(limit), pages: 0 },
            });
        }

        // Filter by type
        const now = new Date();
        if (type === 'upcoming') {
            query.occurrenceDate = { $gte: now };
            query.status = { $in: ['pending', 'confirmed'] };
        } else if (type === 'past') {
            query.$or = [
                { occurrenceDate: { $lt: now } },
                { status: { $in: ['cancelled', 'completed'] } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const bookings = await Booking.find(query)
            .populate('player', 'fullName email')
            .populate({
                path: 'session',
                select: 'title location coach occurrences',
                populate: { path: 'coach', select: 'fullName' },
            })
            .sort({ occurrenceDate: type === 'past' ? -1 : 1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Booking.countDocuments(query);

        res.json({
            bookings,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get specific booking by ID
 * GET /api/bookings/:id
 */
export const getBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const booking = await Booking.findById(id)
            .populate({
                path: 'session',
                select: 'title location coach occurrences description',
                populate: { path: 'coach', select: 'fullName email' },
            })
            .populate('player', 'fullName email');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Verify ownership (player or coach can view)
        const isPlayer = booking.player._id.toString() === userId.toString();
        const isCoach = booking.session.coach._id.toString() === userId.toString();

        if (!isPlayer && !isCoach) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ booking });
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Cancel a booking
 * PUT /api/bookings/:id/cancel
 */
export const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const playerId = req.user._id;

        const booking = await Booking.findById(id);

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Verify ownership
        if (booking.player.toString() !== playerId.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Check if already cancelled or completed
        if (booking.status === 'cancelled') {
            return res.status(400).json({ message: 'Booking already cancelled' });
        }

        if (booking.status === 'completed') {
            return res.status(400).json({ message: 'Cannot cancel completed booking' });
        }

        // Check if booking is in the past
        if (new Date(booking.occurrenceDate) < new Date()) {
            return res.status(400).json({
                message: 'Cannot cancel past bookings',
            });
        }

        // Update booking
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelReason = reason || 'Cancelled by player';

        await booking.save();

        res.json({
            message: 'Booking cancelled successfully',
            booking,
        });
    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Validate promo code
 * POST /api/bookings/validate-promo
 */
export const validatePromoCode = async (req, res) => {
    try {
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ message: 'Promo code is required' });
        }

        const promo = PROMO_CODES[code.toUpperCase()];

        if (!promo) {
            return res.status(404).json({
                message: 'Invalid or expired promo code',
                valid: false,
            });
        }

        res.json({
            message: 'Valid promo code',
            valid: true,
            discount: promo.discount,
            type: promo.type,
            code: code.toUpperCase(),
        });
    } catch (error) {
        console.error('Validate promo error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
