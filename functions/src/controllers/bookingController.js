
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Session from '../models/Session.js';
import Notification from '../models/Notification.js';
import Earning from '../models/Earning.js';
import PromoCode from '../models/PromoCode.js';
import CommissionSettings from '../models/CommissionSettings.js';

// Helper: resolve a promo code from the database and return the discount amount
async function resolvePromoDiscount(promoCode, baseAmount) {
    if (!promoCode) return 0;
    try {
        const promo = await PromoCode.findOne({
            code: promoCode.toUpperCase(),
            status: 'active',
            endDate: { $gte: new Date() },
        });
        if (!promo) return 0;
        if (promo.minimumPrice && baseAmount < promo.minimumPrice) return 0;
        let discount = 0;
        if (promo.discountType === 'percentage') {
            discount = baseAmount * (promo.discountValue / 100);
        } else {
            discount = promo.discountValue;
        }
        return Math.min(discount, baseAmount);
    } catch (e) {
        console.error('Promo code resolution error:', e);
        return 0;
    }
}

/**
 * Create a new booking
 * POST /api/bookings
 */
export const createBooking = async (req, res) => {
    try {
        const { sessionId, occurrenceDate, occurrenceDates, paymentMethod, promoCode, playerId: requestedPlayerId } = req.body;
        const userId = req.user.userId;

        // Resolve Player ID (It should be a PlayerProfile ID now)
        let playerProfileId = requestedPlayerId;

        if (req.user.role === 'player') {
            const PlayerProfile = mongoose.model('PlayerProfile');
            const profile = await PlayerProfile.findOne({ userId: userId });
            if (!profile) return res.status(404).json({ message: 'Player profile not found' });
            playerProfileId = profile._id;
        } else if (req.user.role === 'guardian') {
            if (!playerProfileId) return res.status(400).json({ message: 'Player ID is required for guardian bookings' });
            // Verify guardian owns this player
            const GuardianProfile = mongoose.model('GuardianProfile');
            const guardian = await GuardianProfile.findOne({ userId: userId, players: playerProfileId });
            if (!guardian) return res.status(403).json({ message: 'You do not have permission to book for this player' });
        }

        // Normalize dates to an array
        const datesToBook = occurrenceDates && Array.isArray(occurrenceDates)
            ? occurrenceDates
            : [occurrenceDate];

        if (paymentMethod === 'test') {
            console.log(`[TEST BOOKING] PlayerProfile ${playerProfileId} booking session ${sessionId} for ${datesToBook.length} dates`);
        }

        // Validate required fields
        if (!sessionId || datesToBook.length === 0 || !datesToBook[0] || !paymentMethod) {
            return res.status(400).json({
                message: 'Session ID, occurrence date(s), and payment method are required',
            });
        }

        // Check if session exists
        const session = await Session.findById(sessionId).populate('coach', 'fullName');
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Calculate pricing based on Session data instead of hardcoded 60
        const sessionFee = session.pricing?.amount || 60.00;
        
        // Get dynamic commission/service fee from settings
        const commissionSettings = await CommissionSettings.getSettings();
        const guardianUserId = req.user?.userId || req.user?.id;
        const commissionCalc = commissionSettings.calculateCommission(
            sessionFee,
            guardianUserId,
            null // sportName - could be added from session if available
        );
        const serviceFee = commissionCalc.amount;

        const tax = 0.00;
        let discountTotal = 0.00;

        // Apply promo code if provided
        if (promoCode) {
            discountTotal = await resolvePromoDiscount(promoCode, sessionFee);
        }

        const createdBookings = [];
        const errors = [];

        for (const dateStr of datesToBook) {
            try {
                const requestedDate = new Date(dateStr);

                // Verify the occurrence date is valid for this session
                const isValidOccurrence = session.timeSlots.some(
                    (occ) => new Date(occ.startTime).getTime() === requestedDate.getTime()
                );

                if (!isValidOccurrence) {
                    errors.push(`Invalid occurrence date: ${dateStr}`);
                    continue;
                }

                // Check if player has already booked this occurrence
                const existingBooking = await Booking.findOne({
                    player: playerProfileId,
                    session: sessionId,
                    occurrenceDate: requestedDate,
                    status: { $in: ['pending', 'confirmed'] },
                });

                if (existingBooking) {
                    errors.push(`Session already booked for date: ${dateStr}`);
                    continue;
                }

                const total = sessionFee + serviceFee + tax - discountTotal;

                // Create booking
                const booking = new Booking({
                    player: playerProfileId,
                    session: sessionId,
                    occurrenceDate: requestedDate,
                    paymentMethod,
                    pricing: {
                        sessionFee,
                        serviceFee,
                        tax,
                        discount: discountTotal,
                        total,
                    },
                    promoCode: promoCode?.toUpperCase(),
                    status: session.enrollmentSettings?.autoAccept ? 'confirmed' : 'pending',
                });

                await booking.save();

                // Populate basic info for response/notification
                await booking.populate([
                    { path: 'player', select: 'fullName profilePhoto' }
                ]);

                createdBookings.push(booking);

                // Update Session Participants
                await Session.findByIdAndUpdate(sessionId, {
                    $addToSet: {
                        assignedPlayers: {
                            player: playerProfileId,
                            status: booking.status,
                            joinedAt: new Date(),
                        }
                    }
                });

                // Create Earning Record
                const coachNetEarning = sessionFee; // Coach gets sessionFee
                await Earning.create({
                    coach: (session.coach && session.coach._id) ? session.coach._id : session.coach,
                    session: session._id,
                    booking: booking._id,
                    player: playerProfileId,
                    amount: total,
                    sessionTitle: session.title,
                    sessionDate: requestedDate,
                    sessionType: session.sessionType === 'one-time' ? 'one-on-one' : 'group',
                    status: 'confirmed',
                    currency: session.pricing?.currency || 'USD',
                    platformFee: serviceFee,
                    netAmount: coachNetEarning,
                });

                // Create notification for the coach
                try {
                    await Notification.create({
                        recipient: session.coach._id || session.coach,
                        sender: userId,
                        type: 'booking_confirmed',
                        category: 'Schedule',
                        title: 'New Booking Confirmed',
                        description: `${booking.player.fullName} has booked your session "${session.title}" on ${requestedDate.toLocaleDateString()}`,
                        priority: 'high',
                        relatedEntity: {
                            entityType: 'booking',
                            entityId: booking._id,
                        },
                    });
                } catch (notifError) {
                    console.error('Failed to create notification:', notifError);
                }

            } catch (innerError) {
                console.error(`Error booking date ${dateStr}:`, innerError);
                errors.push(`Failed to book date ${dateStr}: ${innerError.message}`);
            }
        }

        if (createdBookings.length === 0) {
            return res.status(400).json({
                message: 'Failed to create any bookings',
                errors
            });
        }

        res.status(201).json({
            message: `Successfully created ${createdBookings.length} booking(s)`,
            booking: createdBookings[0], // Return the first one for backwards compatibility
            bookings: createdBookings,
            errors: errors.length > 0 ? errors : undefined
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
            query.player = userId; // Wait, this logic was for User IDs. We need Profile IDs now.
            const PlayerProfile = mongoose.model('PlayerProfile');
            const profile = await PlayerProfile.findOne({ userId: userId });
            if (profile) {
                query.player = profile._id;
            } else {
                return res.json({ bookings: [], pagination: { total: 0, page: 1, limit: parseInt(limit), pages: 0 } });
            }
        } else if (userRole === 'guardian') {
            // Find all players associated with this guardian
            const GuardianProfile = mongoose.model('GuardianProfile');
            const guardian = await GuardianProfile.findOne({ userId: userId });
            if (guardian && guardian.players) {
                query.player = { $in: guardian.players };
            } else {
                return res.json({ bookings: [], pagination: { total: 0, page: 1, limit: parseInt(limit), pages: 0 } });
            }
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
            .populate({
                path: 'player',
                select: 'fullName profilePhoto',
                populate: { path: 'userId', select: 'email' } // Optional: get email if exists
            })
            .populate({
                path: 'session',
                select: 'title location coach occurrences',
                populate: {
                    path: 'coach',
                    select: 'role fullName profilePhoto phoneNumber',
                    populate: {
                        path: 'coachProfile',
                        select: 'fullName profilePhoto coachTitle'
                    }
                },
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
        const userId = req.user.userId;

        const booking = await Booking.findById(id)
            .populate({
                path: 'session',
                select: 'title location coach occurrences description',
                populate: { path: 'coach', select: 'fullName email' },
            })
            .populate({
                path: 'player',
                select: 'fullName profilePhoto guardianId userId',
                populate: { path: 'userId', select: 'email' }
            });

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Verify ownership 
        // 1. Is it the associated player's User?
        let isAuthorized = false;

        // Resolve booking player profile
        const bookingPlayerProfile = booking.player;

        if (userRole === 'player' && bookingPlayerProfile.userId && bookingPlayerProfile.userId.toString() === userId.toString()) {
            isAuthorized = true;
        } else if (userRole === 'guardian' && bookingPlayerProfile.guardianId && bookingPlayerProfile.guardianId.toString() === userId.toString()) {
            isAuthorized = true;
        } else if (userRole === 'coach' && booking.session.coach._id.toString() === userId.toString()) {
            isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ booking });
    } catch (error) {
        console.error('Get booking error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get coach's bookings (incoming requests or confirmed sessions)
 * GET /api/bookings/coach?type=upcoming|past|cancelled&limit=10&page=1
 */
export const getCoachBookings = async (req, res) => {
    try {
        const coachId = req.user.userId;
        const { type = 'upcoming', limit = 20, page = 1 } = req.query;

        // 1. Find all sessions owned by this coach
        const sessions = await Session.find({ coach: coachId }).select('_id');
        const sessionIds = sessions.map(s => s._id);

        console.log(`[getCoachBookings] CoachId: ${coachId}, Type: ${type}`);
        console.log(`[getCoachBookings] Found ${sessions.length} sessions for coach`);

        let query = { session: { $in: sessionIds } };
        const now = new Date();

        if (type === 'upcoming') {
            query.occurrenceDate = { $gte: now };
            query.status = { $in: ['pending', 'confirmed'] };
        } else if (type === 'past') {
            query.$or = [
                { occurrenceDate: { $lt: now } },
                { status: 'completed' }
            ];
        } else if (type === 'cancelled') {
            query.status = { $in: ['cancelled', 'declined'] };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const bookings = await Booking.find(query)
            .populate({
                path: 'player',
                select: 'fullName profilePhoto', // PlayerProfile fields
                populate: { path: 'userId', select: 'email phoneNumber' } // User fields
            })
            .populate('session', 'title location')
            .sort({ occurrenceDate: type === 'past' ? -1 : 1 })
            .limit(parseInt(limit))
            .skip(skip);

        const total = await Booking.countDocuments(query);

        console.log(`[getCoachBookings] Found ${bookings.length} bookings (total: ${total})`);

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
        console.error('Get coach bookings error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Update booking status (Coach: Accept/Decline/Cancel)
 * PUT /api/bookings/:id/status
 */
export const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // status: 'confirmed' | 'cancelled' | 'declined'
        const coachId = req.user.userId;

        const booking = await Booking.findById(id).populate('session');
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Verify coach ownership
        if (booking.session.coach.toString() !== coachId.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Resolve Notification Recipient (User)
        // booking.player is currently just an ID (if not populated) or Profile object (if populated)
        // We need to fetch the profile to get userId or guardianId
        const PlayerProfile = mongoose.model('PlayerProfile');
        const playerProfile = await PlayerProfile.findById(booking.player);

        let recipientId = null;
        if (playerProfile) {
            if (playerProfile.userId) {
                recipientId = playerProfile.userId;
            } else if (playerProfile.guardianId) {
                recipientId = playerProfile.guardianId;
            }
        }

        if (recipientId) {
            if (['cancelled', 'declined'].includes(status)) {
                // Process Refund Logic Here (Mock)
                booking.status = status;
                booking.cancelledAt = new Date();
                booking.cancelReason = reason || 'Cancelled by coach';

                // Update Earning
                await Earning.findOneAndUpdate(
                    { booking: booking._id },
                    { status: 'refunded' }
                );

                // Notify Player/Guardian
                try {
                    await Notification.create({
                        recipient: recipientId,
                        sender: coachId,
                        type: 'booking_cancelled',
                        category: 'Schedule',
                        title: 'Session Cancelled',
                        description: `Your session "${booking.session.title}" on ${new Date(booking.occurrenceDate).toLocaleDateString()} has been cancelled/declined by the coach.`,
                        relatedEntity: { entityType: 'booking', entityId: booking._id }
                    });
                } catch (e) { console.error('Notification error', e); }

            } else if (status === 'confirmed') {
                booking.status = 'confirmed';

                // Notify Player/Guardian
                try {
                    await Notification.create({
                        recipient: recipientId,
                        sender: coachId,
                        type: 'booking_confirmed',
                        category: 'Schedule',
                        title: 'Booking Confirmed',
                        description: `Your booking for "${booking.session.title}" has been confirmed!`,
                        relatedEntity: { entityType: 'booking', entityId: booking._id }
                    });
                } catch (e) { console.error('Notification error', e); }
            }
        } else {
            // Fallback if profile not found (shouldn't happen)
            console.error(`Could not resolve recipient for booking ${booking._id}`);
            // Proceed with status update anyway
            if (['cancelled', 'declined'].includes(status)) {
                booking.status = status;
                booking.cancelledAt = new Date();
                booking.cancelReason = reason || 'Cancelled by coach';
            } else if (status === 'confirmed') {
                booking.status = 'confirmed';
            }

            // Sync with Session Participants
            await Session.findOneAndUpdate(
                {
                    _id: booking.session._id,
                    'assignedPlayers.player': booking.player
                },
                {
                    $set: { 'assignedPlayers.$.status': booking.status }
                }
            );
        }

        await booking.save();
        res.json({ message: `Booking ${status} successfully`, booking });

    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Cancel a booking (Player/Guardian)
 * PUT /api/bookings/:id/cancel
 */
export const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.userId; // ID from token
        const userRole = req.user.role;

        const booking = await Booking.findById(id).populate('session').populate('player');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Verify ownership (Player or Guardian)
        let isAuthorized = false;
        if (booking.player.userId && booking.player.userId.toString() === userId.toString()) {
            isAuthorized = true; // Direct player
        } else if (userRole === 'guardian') {
            // Check if player's guardianId matches
            if (booking.player.guardianId && booking.player.guardianId.toString() === userId.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Check if already cancelled
        if (['cancelled', 'completed', 'declined'].includes(booking.status)) {
            return res.status(400).json({ message: 'Booking cannot be cancelled' });
        }

        // Cancellation Policy Check
        const sessionTime = new Date(booking.occurrenceDate);
        const now = new Date();
        const hoursUntilSession = (sessionTime - now) / (1000 * 60 * 60);

        // Refund Logic
        let refundDue = false;
        let refundAmount = 0;

        if (hoursUntilSession > 24) {
            refundDue = true;
            refundAmount = booking.pricing.total; // Full refund
        } else {
            // Too late for refund?
            // User requested "user also can cancel the booking after 24 hours booking time . the refund will be payed"
            // If they meant "If I cancel > 24h before", then strictly adhere to this.
            // If they meant "Cancel anytime, get refund", that's generous. 
            // I'll stick to Standard: Full refund > 24h. No refund < 24h (or partial?).
            // Let's allow cancellation but mark refund as 0 if < 24h, unless we want to be generous.
            // Prompt said: "user also can cancel the booking after 24 hours booking time"
            // This phrasing is tricky. "After 24 hours booking time" -> If I booked yesterday (24h ago), I can cancel?
            // Let's assume the user meant "If cancelled 24 hours BEFORE session".
            // Implementation: Full refund if > 24h.

            // However, for now, let's mark it 'cancelled' regardless, and handle refund manually/stripe.
            // We'll update the earning status.
        }

        // Update Booking
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelReason = reason || 'Cancelled by user';
        await booking.save();

        // Update Earning Status
        await Earning.findOneAndUpdate(
            { booking: booking._id },
            {
                status: refundDue ? 'refunded' : 'cancelled',
                netAmount: refundDue ? 0 : booking.pricing.total
            }
        );

        // Sync with Session Participants
        await Session.findOneAndUpdate(
            {
                _id: booking.session._id,
                'assignedPlayers.player': booking.player
            },
            {
                $set: { 'assignedPlayers.$.status': 'cancelled' }
            }
        );

        // Notify Coach
        try {
            await Notification.create({
                recipient: booking.session.coach,
                sender: userId,
                type: 'booking_cancelled',
                category: 'Schedule',
                title: 'Booking Cancelled',
                description: `Booking for "${booking.session.title}" on ${sessionTime.toLocaleDateString()} has been cancelled by the user.`,
                relatedEntity: { entityType: 'booking', entityId: booking._id }
            });
        } catch (e) { console.error('Notification error', e); }

        res.json({
            message: 'Booking cancelled successfully',
            refundDue,
            refundAmount,
            booking,
        });
    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Validate a promo code
 * POST /api/bookings/validate-promo
 */
export const validatePromoCode = async (req, res) => {
    try {
        const { code, planId, userId } = req.body;

        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Promo code is required'
            });
        }

        // Find promo code in database
        const promoCode = await PromoCode.findOne({
            code: code.toUpperCase(),
            status: 'active',
        });

        if (!promoCode) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or inactive promo code'
            });
        }

        // Check date validity
        const now = new Date();
        if (promoCode.startDate > now || promoCode.endDate < now) {
            return res.status(400).json({
                success: false,
                message: 'Promo code is not valid at this time'
            });
        }

        // Check usage limits
        if (promoCode.usageLimitEnabled) {
            const limit = promoCode.maxRedemptions || promoCode.totalUsageLimit;
            if (limit && promoCode.currentRedemptions >= limit) {
                return res.status(400).json({
                    success: false,
                    message: 'Promo code usage limit exceeded'
                });
            }

            // Check per-user limit for commission type
            if (promoCode.category === 'commission' && userId && promoCode.limitPerUser) {
                const userUsageCount = promoCode.usageHistory.filter(
                    usage => usage.userId.toString() === userId
                ).length;

                if (userUsageCount >= promoCode.limitPerUser) {
                    return res.status(400).json({
                        success: false,
                        message: 'You have exceeded the usage limit for this promo code'
                    });
                }
            }
        }

        // Check plan applicability for subscription type
        if (promoCode.category === 'subscription' && planId) {
            if (!promoCode.applicablePlans.includes(planId)) {
                return res.status(400).json({
                    success: false,
                    message: 'This promo code is not applicable to the selected plan'
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                valid: true,
                promoCode: {
                    id: promoCode._id,
                    code: promoCode.code,
                    discountType: promoCode.discountType,
                    discountValue: promoCode.discountValue,
                    minimumPrice: promoCode.minimumPrice,
                    category: promoCode.category,
                }
            },
            message: 'Promo code is valid'
        });
    } catch (error) {
        console.error('Validate promo error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};



/**
 * Create a private 1-on-1 booking
 * POST /api/bookings/private
 */
export const createPrivateBooking = async (req, res) => {
    try {
        const { coachId, startTime, durationMinutes = 60, paymentMethod, promoCode, playerIds } = req.body;
        const user = req.user;

        console.log(`[CreatePrivateBooking] Request from user: ${user.userId} (${user.role})`);
        console.log(`[CreatePrivateBooking] Received coachId: ${coachId}`);
        console.log(`[CreatePrivateBooking] PlayerIds: ${playerIds}`);

        // Determine players to be booked
        let playersToBook = [];
        if (user.role === 'guardian') {
            if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
                return res.status(400).json({ message: 'Please select at least one player' });
            }
            playersToBook = playerIds;
        } else {
            // Player booking for themselves — must use PlayerProfile ID not User ID
            const PlayerProfileModel = mongoose.model('PlayerProfile');
            const playerProfile = await PlayerProfileModel.findOne({ userId: user.userId || user.id });
            if (!playerProfile) {
                return res.status(400).json({ message: 'Player profile not found. Please complete your profile.' });
            }
            playersToBook = [playerProfile._id];
        }

        // 1. Validate Input
        if (!coachId || !startTime || !paymentMethod) {
            return res.status(400).json({
                message: 'Coach ID, start time, and payment method are required',
            });
        }

        const start = new Date(startTime);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        // 2. Fetch Coach Profile (Robust lookup)
        const CoachProfile = mongoose.model('CoachProfile');
        let coachProfile = await CoachProfile.findOne({ userId: coachId });

        // If not found by User ID, try by Coach Profile ID
        if (!coachProfile) {
            if (mongoose.Types.ObjectId.isValid(coachId)) {
                coachProfile = await CoachProfile.findById(coachId);
            }
        }

        if (!coachProfile) {
            console.log(`[CreatePrivateBooking] FAILURE: Coach profile not found for ID: ${coachId}`);
            console.log(`[CreatePrivateBooking] Is Valid ObjectId: ${mongoose.Types.ObjectId.isValid(coachId)}`);
            return res.status(404).json({ message: 'Coach profile not found' });
        }

        // IMPORTANT: Use the resolved User ID for session creation and checks
        // as the passed 'coachId' might be the profile ID
        const finalCoachId = coachProfile.userId;

        // 3. Check Availability (Double check)
        const conflict = await Session.findOne({
            coach: finalCoachId,
            status: { $in: ['published', 'draft'] },
            'timeSlots': {
                $elemMatch: {
                    $or: [
                        { startTime: { $lt: end }, endTime: { $gt: start } }
                    ]
                }
            }
        });

        if (conflict) {
            return res.status(400).json({ message: 'Selected slot is no longer available' });
        }

        // 4. Create Private Session
        const sessionFee = coachProfile.defaultPricing?.hourlyRate || 0;
        const adjustedFee = (sessionFee / 60) * durationMinutes;

        const session = new Session({
            coach: finalCoachId,
            title: '1-on-1 Session',
            description: `Private session with ${playersToBook.length > 1 ? 'Multiple Players' : 'Player'}`,
            location: coachProfile.city || 'TBD',
            isRecurring: false,
            capacity: { max: playersToBook.length },
            pricing: {
                amount: parseFloat(adjustedFee.toFixed(2)),
                currency: coachProfile.defaultPricing?.currency || 'USD',
                pricePerPerson: true,
            },
            timeSlots: [{
                startTime: start,
                endTime: end,
                durationMinutes: durationMinutes,
                bookedCount: playersToBook.length
            }],
            status: 'published',
            createdBy: user.userId || user.id,
            assignedPlayers: playersToBook.map(pid => ({
                player: pid,
                status: 'confirmed',
                joinedAt: new Date()
            }))
        });

        await session.save();

        // 5. Create Bookings (One per player)

        // Get dynamic commission/service fee from settings
        const commissionSettings = await CommissionSettings.getSettings();
        const guardianUserId = req.user?.userId || req.user?.id;
        const commissionCalc = commissionSettings.calculateCommission(
            adjustedFee,
            guardianUserId,
            null // sportName - could be added from session if available
        );
        const serviceFee = commissionCalc.amount;
        
        const tax = 0.00;
        let discount = 0.00;

        // Apply promo code if provided
        if (promoCode) {
            discount = await resolvePromoDiscount(promoCode, adjustedFee);
        }

        const totalPerPerson = adjustedFee + serviceFee + tax - discount;

        const bookings = [];
        for (const pid of playersToBook) {
            const booking = new Booking({
                player: pid,
                session: session._id,
                occurrenceDate: start,
                paymentMethod,
                pricing: {
                    sessionFee: adjustedFee,
                    serviceFee,
                    tax,
                    discount,
                    total: totalPerPerson,
                },
                promoCode: promoCode?.toUpperCase(),
                status: 'confirmed',
            });
            await booking.save();
            bookings.push(booking);
        }

        // Notification (Send to Coach)
        try {
            await Notification.create({
                recipient: finalCoachId,
                sender: user.userId || user.id,
                type: 'booking_confirmed',
                category: 'Schedule',
                title: 'New Private Session Confirmed',
                description: `${user.fullName} has booked a private session for ${playersToBook.length} player(s) on ${start.toLocaleDateString()}`,
                priority: 'high',
                relatedEntity: {
                    entityType: 'session',
                    entityId: session._id,
                },
            });
        } catch (e) { console.error('Notification error:', e); }

        // Create Earnings for Private Bookings
        try {
            const earningsPromises = bookings.map(booking => {
                // Coach's net earning = sessionFee (total - serviceFee)
                const coachNetEarning = booking.pricing.sessionFee;

                return Earning.create({
                    coach: finalCoachId,
                    session: session._id,
                    booking: booking._id,
                    player: booking.player, // Use PlayerProfile ID for proper population
                    amount: booking.pricing.total,
                    sessionTitle: session.title,
                    sessionDate: start,
                    sessionType: 'one-on-one', // Private is effectively 1-on-1 or small group
                    status: 'confirmed',
                    currency: 'USD',
                    platformFee: booking.pricing.serviceFee, // Track the commission
                    netAmount: coachNetEarning, // Coach gets sessionFee only
                });
            });
            await Promise.all(earningsPromises);
        } catch (earningError) {
            console.error('Failed to create private earnings:', earningError);
        }

        res.status(201).json({
            message: 'Private session booked successfully',
            bookings,
            session
        });

    } catch (error) {
        console.error('Create private booking error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
