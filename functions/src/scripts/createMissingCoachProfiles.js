import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import CoachProfile from '../models/CoachProfile.js';

dotenv.config();

const fixMissingProfiles = async () => {
    try {
        await connectDB();
        console.log("\n🔍 Checking for coaches with missing profiles...\n");

        // 1. Get all coach users
        const coaches = await User.find({ role: "coach" });

        let fixedCount = 0;

        for (const user of coaches) {
            // Check if profile exists separately (to be sure)
            const existingProfile = await CoachProfile.findOne({ userId: user._id });

            if (!existingProfile) {
                console.log(`🛠️ Fixing profile for: ${user.fullName} (${user._id})`);

                // Create new profile
                const newProfile = await CoachProfile.create({
                    userId: user._id,
                    plan: "free",
                    isVerified: false,
                    specialization: "General",
                    about: `Coach ${user.fullName} is ready to help you improve your game.`,
                    experience: "1+ years",
                    rating: 4.0, // Default for now
                    rate: 20,    // Default rate
                    location: "Online",
                });

                // Link back to user
                user.coachProfile = newProfile._id;
                await user.save();

                console.log(`✅ Created Profile ID: ${newProfile._id}`);
                fixedCount++;
            } else {
                // Ensure user has the reference if it was missing
                if (!user.coachProfile || user.coachProfile.toString() !== existingProfile._id.toString()) {
                    console.log(`🔗 Relinking existing profile for: ${user.fullName}`);
                    user.coachProfile = existingProfile._id;
                    await user.save();
                }
            }
        }

        console.log(`\n🎉 Done! Fixed ${fixedCount} missing profiles.\n`);

    } catch (error) {
        console.error("Error fixing profiles:", error);
    } finally {
        process.exit(0);
    }
};

fixMissingProfiles();
