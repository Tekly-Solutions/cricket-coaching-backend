import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Setup __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '../../.env') });

// Import initialized Firebase Admin
import admin from '../config/firebase.js';

const cleanDatabase = async () => {
    try {
        console.log('--- Starting Database Cleanup ---');

        // 1. Clean MongoDB
        const MONGO_URI = process.env.MONGO_URI;
        if (!MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env file');
        }

        console.log('\nConnecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        console.log('Dropping MongoDB database...');
        await mongoose.connection.db.dropDatabase();
        console.log('✅ MongoDB database dropped successfully');

        // 2. Clean Firebase Auth Users
        console.log('\nFetching Firebase users...');
        let allUsers = [];
        let pageToken;
        
        // Fetch all users
        do {
            const listUsersResult = await admin.auth().listUsers(1000, pageToken);
            listUsersResult.users.forEach((userRecord) => {
                allUsers.push(userRecord.uid);
            });
            pageToken = listUsersResult.pageToken;
        } while (pageToken);

        console.log(`Found ${allUsers.length} users in Firebase`);

        if (allUsers.length > 0) {
            console.log('Deleting Firebase users...');
            // Delete users in batches of 1000 (Firebase Admin SDK limit)
            for (let i = 0; i < allUsers.length; i += 1000) {
                const batch = allUsers.slice(i, i + 1000);
                const deleteResult = await admin.auth().deleteUsers(batch);
                console.log(`✅ Deleted batch of ${deleteResult.successCount} users`);
                if (deleteResult.failureCount > 0) {
                    console.log(`⚠️ Failed to delete ${deleteResult.failureCount} users in this batch`);
                    deleteResult.errors.forEach((err) => {
                        console.log(err.error.toJSON());
                    });
                }
            }
        } else {
             console.log('✅ No Firebase users to delete');
        }

        console.log('\n--- Cleanup Finished Successfully ---');

    } catch (error) {
        console.error('\n❌ Error during cleanup:', error);
    } finally {
        // Disconnect from MongoDB and exit
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\nDisconnected from MongoDB');
        }
        process.exit(0);
    }
};

// Confirm before running
console.log('⚠️  WARNING: This will DELETE ALL DATA in your MongoDB and ALL USERS in Firebase Auth.');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...');

setTimeout(cleanDatabase, 5000);
