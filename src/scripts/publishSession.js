
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Session from '../models/Session.js';

dotenv.config();

const publishSession = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const now = new Date();

        // Find a future session that is currently a draft
        const session = await Session.findOne({
            status: 'draft',
            'timeSlots.startTime': { $gte: now }
        });

        if (session) {
            session.status = 'published';
            await session.save();
            console.log(`Updated session "${session.title}" (ID: ${session._id}) to 'published'.`);
            console.log(`Start Time: ${session.timeSlots[0].startTime}`);
        } else {
            console.log('No future draft sessions found to publish.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

publishSession();
