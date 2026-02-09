export const createPrivateBooking = async (req, res) => {
    try {
        const { coachId, startTime, durationMinutes = 60, paymentMethod, promoCode } = req.body;
        const playerId = req.user._id;

        // 1. Validate Input
        if (!coachId || !startTime || !paymentMethod) {
            return res.status(400).json({
                message: 'Coach ID, start time, and payment method are required',
            });
        }

        const start = new Date(startTime);
        const end = new Date(start.getTime() + durationMinutes * 60000);

        // 2. Fetch Coach Profile for Pricing
        // Need to find CoachProfile by userId (coachId)
        const CoachProfile = mongoose.model('CoachProfile');
        let coachProfile = await CoachProfile.findOne({ userId: coachId });

        if (!coachProfile) {
            return res.status(404).json({ message: 'Coach profile not found' });
        }

        // 3. Check Availability (Double check)
        // Check for conflicting sessions for this coach
        const conflict = await Session.findOne({
            coach: coachId,
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
        const sessionFee = coachProfile.defaultPricing?.hourlyRate || 0; // Adjust if duration != 60?
        // Simple logic: (rate / 60) * duration
        const adjustedFee = (sessionFee / 60) * durationMinutes;

        const session = new Session({
            coach: coachId,
            title: '1-on-1 Session',
            description: `Private session with ${req.user.fullName}`, // or just "Private Session"
            location: 'TBD', // Or from coach profile default?
            isRecurring: false,
            capacity: 1,
            pricing: {
                amount: parseFloat(adjustedFee.toFixed(2)),
                currency: coachProfile.defaultPricing?.currency || 'USD',
                pricePerPerson: true,
            },
            timeSlots: [{
                startTime: start,
                endTime: end,
                durationMinutes: durationMinutes,
                bookedCount: 1 // Since we are booking it immediately
            }],
            status: 'published',
            createdBy: playerId, // Or system?
            assignedPlayers: [{
                player: playerId,
                status: 'confirmed',
                joinedAt: new Date()
            }]
        });

        await session.save();

        // 5. Create Booking
        // Reuse createBooking logic or call it?
        // Since we have the session ID now, we can manually create the booking to avoid round-trip or re-validation issues.

        const serviceFee = 2.50;
        const tax = 0.00;
        let discount = 0.00;

        // Apply promo code if provided
        if (promoCode) {
            // ... (reuse promo logic or import it)
            // simplified for now
        }

        const total = adjustedFee + serviceFee + tax - discount;

        const booking = new Booking({
            player: playerId,
            session: session._id,
            occurrenceDate: start, // For 1-on-1, occurrence matches session start
            paymentMethod,
            pricing: {
                sessionFee: adjustedFee,
                serviceFee,
                tax,
                discount,
                total,
            },
            promoCode: promoCode?.toUpperCase(),
            status: 'confirmed',
        });

        await booking.save();

        // Populate details
        await booking.populate([
            {
                path: 'session',
                select: 'title location coach',
                populate: { path: 'coach', select: 'fullName' },
            },
            { path: 'player', select: 'fullName email' },
        ]);

        // Notification
        try {
            await Notification.create({
                recipient: coachId,
                sender: playerId,
                type: 'booking_confirmed',
                category: 'Schedule',
                title: 'New Private Session Confirmed',
                description: `${req.user.fullName} has booked a private session on ${start.toLocaleDateString()}`,
                priority: 'high',
                relatedEntity: {
                    entityType: 'Booking',
                    entityId: booking._id,
                },
            });
        } catch (e) { console.error(e); }

        res.status(201).json({
            message: 'Private session booked successfully',
            booking,
            session // Return session too?
        });

    } catch (error) {
        console.error('Create private booking error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
