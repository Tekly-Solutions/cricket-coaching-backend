const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../d:/Cricket App Full/cricket-coaching-backend/.env') });

async function debug() {
    try {
        await mongoose.connect('mongodb://localhost:27017/cricket_coaching');
        console.log('Connected to MongoDB');

        const Booking = require('./src/models/Booking.js').default;
        const Earning = require('./src/models/Earning.js').default;
        const Session = require('./src/models/Session.js').default;
        const User = require('./src/models/User.js').default;

        const coach = await User.findOne({ role: 'coach' });
        if (!coach) {
            console.log('No coach found');
            return;
        }
        const coachId = coach._id;
        console.log('Analyzing for Coach:', coach.email, 'ID:', coachId);

        const allSessions = await Session.find({ coach: coachId }).select('_id title');
        const sessionIds = allSessions.map(s => s._id);

        const bookings = await Booking.find({
            session: { $in: sessionIds },
            status: { $in: ['confirmed', 'completed'] }
        }).sort({ createdAt: -1 });

        const earnings = await Earning.find({
            coach: coachId,
            status: { $in: ['confirmed', 'paid'] }
        }).sort({ createdAt: -1 });

        console.log('\n--- DASHBOARD LOGIC (BOOKINGS) ---');
        let bookingSum = 0;
        bookings.forEach(b => {
            const fee = b.pricing?.sessionFee || 0;
            bookingSum += fee;
            console.log(`Booking ID: ${b._id} | Session: ${b.session} | Fee: ${fee} | Total: ${b.pricing?.total} | Status: ${b.status}`);
        });
        console.log('Total Dashboard Earnings (from Bookings):', bookingSum);

        console.log('\n--- EARNINGS SCREEN LOGIC (EARNINGS) ---');
        let earningSum = 0;
        earnings.forEach(e => {
            earningSum += e.netAmount || 0;
            console.log(`Earning ID: ${e._id} | Booking: ${e.booking} | NetAmount: ${e.netAmount} | Status: ${e.status}`);
        });
        console.log('Total Earnings Screen (from Earnings record):', earningSum);

        console.log('\n--- MISMATCHES ---');
        const bookingIdsWithEarning = new Set(earnings.map(e => e.booking?.toString()));
        bookings.forEach(b => {
            if (!bookingIdsWithEarning.has(b._id.toString())) {
                console.log(`MISSING EARNING: Booking ${b._id} (${b.pricing?.sessionFee}) has no confirmed/paid earning record.`);
            }
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
