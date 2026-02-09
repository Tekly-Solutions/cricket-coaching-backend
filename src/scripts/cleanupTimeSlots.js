
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import Session from '../models/Session.js';

dotenv.config();

const cleanupTimeSlots = async () => {
    try {
        const logFile = 'cleanup_debug.log';
        const log = (msg) => {
            console.log(msg);
            fs.appendFileSync(logFile, msg + '\n');
        };

        // Clear previous log
        if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

        await mongoose.connect(process.env.MONGO_URI);
        log('Connected to MongoDB');

        const sessions = await Session.find({});
        log(`Found ${sessions.length} sessions. Checking for duplicates...`);

        let totalFixed = 0;

        for (const session of sessions) {
            const uniqueSlots = [];
            const seenTimes = new Set();
            let hasDuplicates = false;

            // Sort slots by startTime to ensure deterministic processing
            // (though we usually want to keep the one with bookings if duplicates exist,
            // but assuming identical duplicates for now)
            session.timeSlots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

            for (const slot of session.timeSlots) {
                const startTimeStr = new Date(slot.startTime).toISOString();

                if (seenTimes.has(startTimeStr)) {
                    hasDuplicates = true;
                    // Keep the one with bookings (if any) or just the first
                    // Assuming identical for now, but safer to merge bookings if needed (out of scope for quick fix)
                    log(`[Duplicate Found] Session: "${session.title}" (${session._id}) - Time: ${startTimeStr}`);
                } else {
                    seenTimes.add(startTimeStr);
                    uniqueSlots.push(slot);
                }
            }

            if (hasDuplicates) {
                const oldCount = session.timeSlots.length;
                const newCount = uniqueSlots.length;
                log(`Fixing session "${session.title}"... Removed ${oldCount - newCount} duplicates.`);

                // Directly update the array
                session.timeSlots = uniqueSlots;
                await session.save();
                totalFixed++;
            }
        }

        log(`Cleanup complete. Fixed ${totalFixed} sessions.`);
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

cleanupTimeSlots();
