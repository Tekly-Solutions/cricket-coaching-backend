import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Session from '../models/Session.js';

dotenv.config(); // file is at root, so this should work if running from root

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const debugEarnings = async () => {
    await connectDB();

    try {
        // Find the coach (Akshayan)
        const coach = await User.findOne({
            $or: [
                { email: /akshayan/i },
                { fullName: /akshayan/i }
            ],
            role: 'coach'
        });

        if (!coach) {
            console.log('Coach not found');
            return;
        }

        console.log(`Found Coach: ${coach.fullName} (${coach._id})`);

        // Find all sessions for this coach
        const sessions = await Session.find({ coach: coach._id });
        const sessionIds = sessions.map(s => s._id);
        console.log(`Found ${sessions.length} sessions`);

        // Find bookings for these sessions
        const bookings = await Booking.find({
            session: { $in: sessionIds },
            status: { $in: ['confirmed', 'completed'] }
        });

        console.log(`Found ${bookings.length} confirmed/completed bookings`);

        let totalFee = 0;
        let totalTotal = 0;

        bookings.forEach(b => {
            console.log(`Booking ${b._id}:`);
            console.log(`  Session Fee: ${b.pricing.sessionFee}`);
            console.log(`  Service Fee: ${b.pricing.serviceFee}`);
            console.log(`  Tax: ${b.pricing.tax}`);
            console.log(`  Total: ${b.pricing.total}`);

            totalFee += b.pricing.sessionFee;
            totalTotal += b.pricing.total;
        });

        console.log('-----------------------------------');
        console.log(`Calculated Total Session Fees (Net): ${totalFee}`);
        console.log(`Calculated Total of Totals (Gross): ${totalTotal}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
};

debugEarnings();
