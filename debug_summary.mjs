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
        const coaches = await User.find({ role: 'coach' });
        console.log(`Found ${coaches.length} coaches`);

        for (const coach of coaches) {
            const coachId = coach._id;
            const allSessions = await Session.find({ coach: coachId }).select('_id');
            const sessionIds = allSessions.map(s => s._id);

            const bookings = await Booking.find({
                session: { $in: sessionIds },
                status: { $in: ['confirmed', 'completed'] }
            });

            const earnings = await Earning.find({
                coach: coachId,
                status: { $in: ['confirmed', 'paid'] }
            });

            let bookingTotal = 0;
            bookings.forEach(b => bookingTotal += (b.pricing?.sessionFee || 0));

            let earningTotal = 0;
            earnings.forEach(e => earningTotal += (e.netAmount || 0));

            if (bookingTotal > 0 || earningTotal > 0) {
                console.log(`\nCoach: ${coach.email} (${coachId})`);
                console.log(`BOOKING_TOTAL: ${bookingTotal}`);
                console.log(`EARNING_TOTAL: ${earningTotal}`);
                console.log(`BOOKING_COUNT: ${bookings.length}`);
                console.log(`EARNING_COUNT: ${earnings.length}`);

                if (bookingTotal !== earningTotal) {
                    console.log(`!!! DISCREPANCY: ${bookingTotal - earningTotal}`);
                }
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
