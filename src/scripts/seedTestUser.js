import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import User from "../models/User.js";
import CoachProfile from "../models/CoachProfile.js";

dotenv.config();

const seedTestUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        const email = "test@example.com";
        const password = "password123";
        const role = "coach";
        const name = "Test Coach";

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log("Test user already exists");
            process.exit(0);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const firebaseUid = `local_${uuidv4()}`;

        const user = await User.create({
            firebaseUid,
            fullName: name,
            email,
            role,
            password: hashedPassword,
            signInProviders: ["password"],
        });

        await CoachProfile.create({
            userId: user._id,
            plan: "free",
            isVerified: true,
        });

        console.log(`Test user created successfully:\nEmail: ${email}\nPassword: ${password}\nRole: ${role}`);
        process.exit(0);
    } catch (error) {
        console.error("Error seeding user:", error);
        process.exit(1);
    }
};

seedTestUser();
