import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import CoachProfile from '../models/CoachProfile.js';
import User from '../models/User.js';

dotenv.config();

const COACH_USER_ID = '696e5c675c6c0d1d13854469';

async function createCoachProfile() {
  try {
    console.log('🚀 Starting coach profile creation...\n');

    await connectDB();

    // Check if user exists
    const coach = await User.findById(COACH_USER_ID);
    if (!coach) {
      console.error('❌ Coach user not found with ID:', COACH_USER_ID);
      return;
    }

    console.log(`✅ Found coach user: ${coach.fullName} (${coach.email})`);

    // Check if profile already exists
    const existingProfile = await CoachProfile.findOne({ userId: COACH_USER_ID });
    if (existingProfile) {
      console.log('⚠️  Coach profile already exists for this user');
      console.log(`   Profile ID: ${existingProfile._id}`);
      return;
    }

    // Create coach profile
    const coachProfile = await CoachProfile.create({
      userId: COACH_USER_ID,
      profilePhoto: null,
      coachTitle: 'Head Cricket Coach',
      specialties: ['Batting', 'Bowling', 'Fielding'],
      primarySpecialization: 'all-round',
      certifications: [
        'ICC Level 3 Coaching Certificate',
        'ECB Advanced Coaching',
        'Sports Psychology Certification'
      ],
      experienceYears: 10,
      aboutMe: `Passionate cricket coach with over 10 years of experience in developing young talent. Specialized in holistic cricket training covering batting, bowling, and fielding techniques. Committed to creating a positive learning environment that helps players reach their full potential both on and off the field.`,
      plan: 'pro',
      subscription: {
        status: 'active',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      },
      rating: 4.7,
      playersCoachedCount: 0,
      isVerified: true,
      profileCompletionPercentage: 95,
      availability: [],
    });

    console.log('\n✅ Coach profile created successfully!');
    console.log(`   Profile ID: ${coachProfile._id}`);
    console.log(`   Coach: ${coach.fullName}`);
    console.log(`   Title: ${coachProfile.coachTitle}`);
    console.log(`   Plan: ${coachProfile.plan}`);
    console.log(`   Verified: ${coachProfile.isVerified}`);

  } catch (error) {
    console.error('❌ Error creating coach profile:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

createCoachProfile();
