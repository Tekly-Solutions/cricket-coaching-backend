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
        const coach = await User.findOne({ email: 'akshayan078@gmail.com' });
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

        console.log(`\nCoach: ${coach.email} (${coachId})`);
        console.log(`BOOKINGS:`);
        bookings.forEach(b => {
            const hasEarning = earnings.some(e => e.booking?.toString() === b._id.toString());
            console.log(`- Booking ${b._id} | Fee: ${b.pricing?.sessionFee} | Total: ${b.pricing?.total} | Status: ${b.status} | Has Earning: ${hasEarning}`);
        });

        console.log(`\nEARNINGS:`);
        earnings.forEach(e => {
            console.log(`- Earning ${e._id} | Booking: ${e.booking} | Net: ${e.netAmount}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

debug();
