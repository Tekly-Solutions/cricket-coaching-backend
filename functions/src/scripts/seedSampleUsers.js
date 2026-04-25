import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import User from "../models/User.js";
import CoachProfile from "../models/CoachProfile.js";
import PlayerProfile from "../models/PlayerProfile.js";
import GuardianProfile from "../models/GuardianProfile.js";

dotenv.config();

const seedSampleUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Clear existing sample data to avoid duplicates
        console.log("🗑️  Clearing existing sample data...");
        await User.deleteMany({ email: { $regex: /@cricketapp\.com$/ } });
        await CoachProfile.deleteMany({});
        await PlayerProfile.deleteMany({});
        await GuardianProfile.deleteMany({});
        console.log("✅ Existing sample data cleared\n");

        // Ensure PlayerProfile userId index is sparse (allows multiple null values)
        try {
            await PlayerProfile.collection.dropIndex('userId_1');
            console.log("🔧 Dropped old userId index");
        } catch (err) {
            // Index might not exist, that's okay
        }
        await PlayerProfile.collection.createIndex({ userId: 1 }, { unique: true, sparse: true });
        console.log("✅ Recreated userId index as sparse\n");

        const password = "password123";
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log("\n🏏 Creating sample users for Cricket Coaching App...\n");

        // ========== COACHES ==========
        const coaches = [
            {
                fullName: "Sarah Johnson",
                email: "sarah.coach@cricketapp.com",
                role: "coach",
                profile: {
                    coachTitle: "Head Batting Coach",
                    specialties: ["Batting", "Mental Conditioning", "Fielding"],
                    primarySpecialization: "batting",
                    certifications: ["ICC Level 3", "ECB Advanced Coach", "Sports Psychology Cert"],
                    experienceYears: 12,
                    aboutMe: "Passionate about developing young talent with 12+ years of coaching experience. Specialized in technical batting skills and mental game development.",
                    plan: "pro",
                    rating: 4.8,
                    playersCoachedCount: 45,
                    isVerified: true,
                    profileCompletionPercentage: 95
                }
            },
            {
                fullName: "Michael Chen",
                email: "michael.coach@cricketapp.com",
                role: "coach",
                profile: {
                    coachTitle: "Fast Bowling Specialist",
                    specialties: ["Fast Bowling", "Fitness", "Strength & Conditioning"],
                    primarySpecialization: "bowling",
                    certifications: ["ICC Level 2", "Strength & Conditioning Specialist"],
                    experienceYears: 8,
                    aboutMe: "Former professional fast bowler turned coach. Focus on biomechanics, pace development, and injury prevention.",
                    plan: "elite",
                    rating: 4.9,
                    playersCoachedCount: 32,
                    isVerified: true,
                    profileCompletionPercentage: 90
                }
            },
            {
                fullName: "Raj Patel",
                email: "raj.coach@cricketapp.com",
                role: "coach",
                profile: {
                    coachTitle: "Spin Bowling Coach",
                    specialties: ["Spin Bowling", "All-round", "Match Strategy"],
                    primarySpecialization: "bowling",
                    certifications: ["ICC Level 2"],
                    experienceYears: 5,
                    aboutMe: "Specializing in spin bowling techniques and tactical game awareness for all skill levels.",
                    plan: "free",
                    rating: 4.5,
                    playersCoachedCount: 18,
                    isVerified: false,
                    profileCompletionPercentage: 70
                }
            }
        ];

        for (const coachData of coaches) {
            const firebaseUid = `local_${uuidv4()}`;

            const user = await User.create({
                firebaseUid,
                fullName: coachData.fullName,
                email: coachData.email,
                role: coachData.role,
                password: hashedPassword,
                signInProviders: ["password"],
            });

            await CoachProfile.create({
                userId: user._id,
                ...coachData.profile
            });

            console.log(`✅ Coach created: ${coachData.fullName} (${coachData.email})`);
        }

        // ========== GUARDIANS ==========
        const guardians = [
            {
                fullName: "David Martinez",
                email: "david.parent@cricketapp.com",
                phoneNumber: "+1-555-0101"
            },
            {
                fullName: "Emily Thompson",
                email: "emily.parent@cricketapp.com",
                phoneNumber: "+1-555-0102"
            }
        ];

        const guardianUsers = [];
        for (const guardianData of guardians) {
            const firebaseUid = `local_${uuidv4()}`;

            const user = await User.create({
                firebaseUid,
                fullName: guardianData.fullName,
                email: guardianData.email,
                phoneNumber: guardianData.phoneNumber,
                role: "guardian",
                password: hashedPassword,
                signInProviders: ["password"],
            });

            const guardianProfile = await GuardianProfile.create({
                userId: user._id,
                phoneNumber: guardianData.phoneNumber,
                players: [] // Will be populated when creating players
            });

            guardianUsers.push({ user, profile: guardianProfile });
            console.log(`✅ Guardian created: ${guardianData.fullName} (${guardianData.email})`);
        }

        // ========== PLAYERS (Self-managed adults) ==========
        const selfManagedPlayers = [
            {
                fullName: "Alex Rodriguez",
                email: "alex.player@cricketapp.com",
                role: "All-rounder",
                battingStyle: "Right-hand bat",
                bowlingStyle: "Right-arm medium",
                age: "22"
            },
            {
                fullName: "Priya Sharma",
                email: "priya.player@cricketapp.com",
                role: "Batsman",
                battingStyle: "Right-hand bat",
                bowlingStyle: "",
                age: "19"
            }
        ];

        for (const playerData of selfManagedPlayers) {
            const firebaseUid = `local_${uuidv4()}`;

            const user = await User.create({
                firebaseUid,
                fullName: playerData.fullName,
                email: playerData.email,
                role: "player",
                password: hashedPassword,
                signInProviders: ["password"],
            });

            await PlayerProfile.create({
                userId: user._id,
                role: playerData.role,
                battingStyle: playerData.battingStyle,
                bowlingStyle: playerData.bowlingStyle,
                age: playerData.age,
                isSelfManaged: true
            });

            console.log(`✅ Player (self-managed) created: ${playerData.fullName} (${playerData.email})`);
        }

        // ========== PLAYERS (Minors under guardian) ==========
        const minorPlayers = [
            {
                fullName: "Jake Martinez",
                guardianIndex: 0, // David Martinez's child
                role: "Batsman",
                battingStyle: "Left-hand bat",
                bowlingStyle: "",
                age: "14"
            },
            {
                fullName: "Sophia Martinez",
                guardianIndex: 0, // David Martinez's child
                role: "All-rounder",
                battingStyle: "Right-hand bat",
                bowlingStyle: "Right-arm fast",
                age: "15"
            },
            {
                fullName: "Liam Thompson",
                guardianIndex: 1, // Emily Thompson's child
                role: "Bowler",
                battingStyle: "Right-hand bat",
                bowlingStyle: "Left-arm orthodox",
                age: "13"
            }
        ];

        for (const playerData of minorPlayers) {
            const guardian = guardianUsers[playerData.guardianIndex];

            const playerProfile = await PlayerProfile.create({
                fullName: playerData.fullName,
                guardianId: guardian.user._id,
                role: playerData.role,
                battingStyle: playerData.battingStyle,
                bowlingStyle: playerData.bowlingStyle,
                age: playerData.age,
                isSelfManaged: false
            });

            // Add player to guardian's players array
            await GuardianProfile.findByIdAndUpdate(
                guardian.profile._id,
                { $push: { players: playerProfile._id } }
            );

            console.log(`✅ Player (minor) created: ${playerData.fullName} (Guardian: ${guardian.user.fullName})`);
        }

        console.log("\n" + "=".repeat(60));
        console.log("🎉 Sample data seeded successfully!");
        console.log("=".repeat(60));
        console.log("\n📝 LOGIN CREDENTIALS:");
        console.log("Password for all users: password123\n");

        console.log("COACHES:");
        coaches.forEach(c => console.log(`  - ${c.email}`));

        console.log("\nGUARDIANS:");
        guardians.forEach(g => console.log(`  - ${g.email}`));

        console.log("\nPLAYERS (Self-managed):");
        selfManagedPlayers.forEach(p => console.log(`  - ${p.email}`));

        console.log("\nPLAYERS (Minors - no login):");
        minorPlayers.forEach(p => console.log(`  - ${p.fullName}`));

        console.log("\n" + "=".repeat(60) + "\n");

        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding sample users:", error);
        process.exit(1);
    }
};

seedSampleUsers();
