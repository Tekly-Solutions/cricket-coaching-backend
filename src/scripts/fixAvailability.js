import dotenv from 'dotenv';
import mongoose from 'mongoose';
import CoachProfile from '../models/CoachProfile.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '../../.env') });

const fixAvailability = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    // Find all coach profiles where availability is an array (wrong type)
    const profiles = await CoachProfile.find({ availability: { $type: 'array' } });
    console.log(`Found ${profiles.length} profiles with array availability`);

    for (const profile of profiles) {
      console.log(`Fixing profile for userId: ${profile.userId}`);
      
      // Unset the wrong field
      await CoachProfile.updateOne(
        { _id: profile._id },
        { $unset: { availability: '' } }
      );

      // Set the correct structure
      await CoachProfile.updateOne(
        { _id: profile._id },
        {
          $set: {
            availability: {
              recurringSchedule: {
                activeDays: [1, 2, 3, 4, 5],
                timeIntervals: [{ start: '09:00 AM', end: '05:00 PM' }],
              },
              blockedDates: [],
            },
          },
        }
      );

      console.log(`✓ Fixed profile for userId: ${profile.userId}`);
    }

    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

fixAvailability();
