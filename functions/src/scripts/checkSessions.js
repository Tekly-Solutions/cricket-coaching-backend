
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import Session from '../models/Session.js';

dotenv.config();

const checkSessions = async () => {
    try {
        const logFile = 'session_debug.log';
        const log = (msg) => {
            console.log(msg);
            fs.appendFileSync(logFile, msg + '\n');
        };

        // Clear previous log
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

        await mongoose.connect(process.env.MONGO_URI);
        log('Connected to MongoDB');

        const now = new Date();
        log(`Current Time: ${now.toISOString()}`);

        const allSessions = await Session.find({});
        log(`Total Sessions: ${allSessions.length}`);

        const publishedSessions = await Session.find({ status: 'published' });
        log(`Published Sessions: ${publishedSessions.length}`);

        const futureSessions = await Session.find({
            status: 'published',
            'timeSlots.startTime': { $gte: now }
        });
        log(`Future Published Sessions: ${futureSessions.length}`);

        if (futureSessions.length === 0) {
            log('No future published sessions found.');

            const recentSessions = await Session.find().sort({ createdAt: -1 }).limit(5);
            log('Recent Sessions Sample:');
            recentSessions.forEach(s => {
                const startTime = s.timeSlots && s.timeSlots.length > 0 ? s.timeSlots[0].startTime : 'N/A';
                log(`- Title: ${s.title}, Status: ${s.status}, StartTime: ${startTime}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkSessions();
