import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import CoachProfile from '../models/CoachProfile.js';

dotenv.config();

const listCoaches = async () => {
    try {
        await connectDB();
        console.log("\nFetching coaches via User role...\n");

        // 1. Get all coach users
        const coaches = await User.find({ role: "coach" }).lean();

        // 2. Get all coach profiles
        const profiles = await CoachProfile.find({}).lean();

        // 3. Map them manually
        const tableData = coaches.map((user) => {
            // Find matching profile by userId
            const profile = profiles.find(p => p.userId.toString() === user._id.toString());

            return {
                Name: user.fullName,
                "User ID": user._id.toString(),
                "Profile ID": profile ? profile._id.toString() : "MISSING PROFILE",
                "Plan": profile ? profile.plan : "N/A",
                "Verified": profile ? profile.isVerified : false,
            };
        });

        if (tableData.length === 0) {
            console.log("No coaches found.");
        } else {
            console.log(JSON.stringify(tableData, null, 2));
        }

    } catch (error) {
        console.error("Error fetching coaches:", error);
    } finally {
        process.exit(0);
    }
};

listCoaches();
