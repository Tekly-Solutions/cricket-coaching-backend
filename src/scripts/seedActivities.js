import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import Activity from '../models/Activity.js';
import User from '../models/User.js';

dotenv.config();

async function seedActivities() {
    try {
        await connectDB();
        console.log('Connected to database for seeding activities...');

        // Use the specific user ID provided
        const userId = '696e5c675c6c0d1d13854469';

        const user = await User.findById(userId);

        if (!user) {
            console.log(`User with ID ${userId} not found.`);
            process.exit(0);
        }

        console.log(`Found user: ${user.fullName} (${user.email})`);

        // Clear existing activities for this user
        await Activity.deleteMany({ userId });
        console.log('Cleared existing activities');

        // Create sample activities
        const activities = [
            {
                userId,
                type: 'performance_logged',
                title: 'New Performance Entry',
                description: 'logged batting practice - 85% accuracy',
                icon: 'run',
                createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 mins ago
            },
            {
                userId,
                type: 'player_joined',
                title: 'Rahul Kumar',
                description: 'joined your cricket coaching program',
                icon: 'person',
                createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
            },
            {
                userId,
                type: 'schedule_change',
                title: 'Practice Schedule',
                description: 'updated for this Friday - moved to 6:00 PM',
                icon: 'calendar',
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            },
            {
                userId,
                type: 'session_completed',
                title: 'Batting Session',
                description: 'completed with 12 participants',
                icon: 'cricket',
                createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
            },
            {
                userId,
                type: 'injury_update',
                title: 'Virat Sharma',
                description: 'reported minor shoulder injury - recovery in progress',
                icon: 'injury',
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
            },
        ];

        await Activity.insertMany(activities);
        console.log(`✅ Created ${activities.length} sample activities for ${user.fullName}`);
        console.log('\nSample activities:');
        activities.forEach((act, i) => {
            console.log(`  ${i + 1}. ${act.title} - ${act.description}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error seeding activities:', error);
        process.exit(1);
    }
}

seedActivities();
