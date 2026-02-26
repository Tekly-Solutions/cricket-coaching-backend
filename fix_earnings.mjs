import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './src/models/Booking.js';
import Earning from './src/models/Earning.js';
import Session from './src/models/Session.js';
import User from './src/models/User.js';

dotenv.config();

const MONGO_URI = "mongodb://burl_sport_db_user:vW8sL2G0kvJz1amA@ac-jwukv2d-shard-00-00.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-01.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-02.onnwqfl.mongodb.net:27017/burlsportdevdb?ssl=true&replicaSet=atlas-grdbw8-shard-0&authSource=admin&retryWrites=true&w=majority";

async function fix() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const coach = await User.findOne({ email: 'akshayan078@gmail.com' });
        const coachId = coach._id;

        const allSessions = await Session.find({ coach: coachId }).select('_id');
        const sessionIds = allSessions.map(s => s._id);

        const bookings = await Booking.find({
            session: { $in: sessionIds },
            status: { $in: ['confirmed', 'completed'] }
        });

        const earnings = await Earning.find({ coach: coachId });
        const bookingIdsWithEarning = new Set(earnings.map(e => e.booking?.toString()));

        let fixedCount = 0;
        for (const b of bookings) {
            if (!bookingIdsWithEarning.has(b._id.toString())) {
                console.log(`Fixing missing earning for Booking: ${b._id} ($${b.pricing?.sessionFee})`);

                const session = await Session.findById(b.session);

                await Earning.create({
                    coach: coachId,
                    session: b.session,
                    booking: b._id,
                    player: b.player,
                    amount: b.pricing?.total || b.pricing?.sessionFee,
                    sessionTitle: session?.title || 'Cricket Session',
                    sessionDate: b.occurrenceDate,
                    sessionType: session?.sessionType === 'one-time' ? 'one-on-one' : 'group',
                    status: 'confirmed',
                    currency: b.pricing?.currency || 'USD',
                    platformFee: b.pricing?.serviceFee || 0,
                    netAmount: b.pricing?.sessionFee,
                });
                fixedCount++;
            }
        }

        console.log(`\nFixed ${fixedCount} missing earning records.`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

fix();
