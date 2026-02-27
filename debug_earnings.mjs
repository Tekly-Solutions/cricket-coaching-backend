import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './src/models/Booking.js';
import Earning from './src/models/Earning.js';
import Session from './src/models/Session.js';
import User from './src/models/User.js';

dotenv.config();

const MONGO_URI = "mongodb://burl_sport_db_user:vW8sL2G0kvJz1amA@ac-jwukv2d-shard-00-00.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-01.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-02.onnwqfl.mongodb.net:27017/burlsportdevdb?ssl=true&replicaSet=atlas-grdbw8-shard-0&authSource=admin&retryWrites=true&w=majority";

async function debug() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB (Atlas)');

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
            console.log(`Booking ID: ${b._id} | Session: ${b.session} | Fee: ${fee} | Total: ${b.pricing?.total} | Status: ${b.status} | CreatedAt: ${b.createdAt}`);
        });
        console.log('Total Dashboard Earnings (from Bookings):', bookingSum);

        console.log('\n--- EARNINGS SCREEN LOGIC (EARNINGS) ---');
        let earningSum = 0;
        earnings.forEach(e => {
            earningSum += e.netAmount || 0;
            console.log(`Earning ID: ${e._id} | Booking: ${e.booking} | NetAmount: ${e.netAmount} | Status: ${e.status} | SessionDate: ${e.sessionDate}`);
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
