import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Session from '../models/Session.js';
import User from '../models/User.js';

dotenv.config();

const COACH_ID = '696e5c675c6c0d1d13854469';
const GUARDIAN_ID = '69739d5f6ef09a984a0a2737';
const SESSION_ID = '697397b46ef09a984a0a2728';

// Sample player data
const samplePlayers = [
  {
    fullName: 'Arjun Patel',
    email: 'arjun.patel@example.com',
    phoneNumber: '+1234567890',
    dateOfBirth: new Date('2010-05-15'),
    skill: 'intermediate',
    firebaseUid: `firebase_arjun_${Date.now()}_1`,
  },
  {
    fullName: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phoneNumber: '+1234567891',
    dateOfBirth: new Date('2011-08-22'),
    skill: 'beginner',
    firebaseUid: `firebase_priya_${Date.now()}_2`,
  },
  {
    fullName: 'Rohan Kumar',
    email: 'rohan.kumar@example.com',
    phoneNumber: '+1234567892',
    dateOfBirth: new Date('2009-12-10'),
    skill: 'advanced',
    firebaseUid: `firebase_rohan_${Date.now()}_3`,
  },
  {
    fullName: 'Meera Reddy',
    email: 'meera.reddy@example.com',
    phoneNumber: '+1234567893',
    dateOfBirth: new Date('2012-03-18'),
    skill: 'intermediate',
    firebaseUid: `firebase_meera_${Date.now()}_4`,
  },
];

// Sample session data
const sampleSessions = [
  {
    title: 'Morning Batting Practice',
    description: 'Focus on defensive techniques and footwork. Suitable for intermediate to advanced players.',
    location: 'Cricket Academy - Main Ground',
    capacity: 15,
    isRecurring: false,
    recurrencePattern: 'none',
    status: 'published',
  },
  {
    title: 'Fast Bowling Masterclass',
    description: 'Learn proper bowling action, run-up techniques, and variations.',
    location: 'Cricket Academy - Practice Nets',
    capacity: 12,
    isRecurring: false,
    recurrencePattern: 'none',
    status: 'published',
  },
  {
    title: 'Fielding Drills & Fitness',
    description: 'High-intensity fielding drills combined with fitness training.',
    location: 'Cricket Academy - Ground B',
    capacity: 20,
    isRecurring: false,
    recurrencePattern: 'none',
    status: 'published',
  },
  {
    title: 'Spin Bowling Workshop',
    description: 'Master the art of spin bowling with variations and flight control.',
    location: 'Cricket Academy - Indoor Arena',
    capacity: 10,
    isRecurring: false,
    recurrencePattern: 'none',
    status: 'published',
  },
];

function generateTimeSlots(daysFromNow, startHour = 9, durationMinutes = 90) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(startHour, 0, 0, 0);

  const startTime = new Date(date);
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);

  return [{
    startTime,
    endTime,
    durationMinutes,
    bookedCount: 0,
  }];
}

async function seedCoachSessions() {
  console.log('🎾 Seeding sessions for coach...');

  const coach = await User.findById(COACH_ID);
  if (!coach) {
    console.error('❌ Coach not found with ID:', COACH_ID);
    return [];
  }

  console.log(`✅ Found coach: ${coach.name || coach.email}`);

  const createdSessions = [];

  for (let i = 0; i < sampleSessions.length; i++) {
    const sessionData = sampleSessions[i];
    
    // Generate time slots for upcoming dates (2, 5, 7, 10 days from now)
    const daysFromNow = [2, 5, 7, 10][i];
    const startHour = [9, 14, 10, 16][i]; // Different times
    
    const session = await Session.create({
      coach: COACH_ID,
      createdBy: COACH_ID,
      ...sessionData,
      timeSlots: generateTimeSlots(daysFromNow, startHour),
    });

    createdSessions.push(session);
    console.log(`✅ Created session: ${session.title} (${session._id})`);
  }

  return createdSessions;
}

async function seedGuardianPlayers() {
  console.log('\n👨‍👩‍👧‍👦 Seeding players for guardian...');

  const guardian = await User.findById(GUARDIAN_ID);
  if (!guardian) {
    console.error('❌ Guardian not found with ID:', GUARDIAN_ID);
    return [];
  }

  console.log(`✅ Found guardian: ${guardian.name || guardian.email}`);

  const createdPlayers = [];

  for (const playerData of samplePlayers) {
    // Check if player already exists
    const existingPlayer = await User.findOne({ email: playerData.email });
    if (existingPlayer) {
      console.log(`⚠️  Player already exists: ${playerData.fullName}`);
      createdPlayers.push(existingPlayer);
      continue;
    }

    const player = await User.create({
      ...playerData,
      role: 'player',
      guardian: GUARDIAN_ID,
      password: 'password123', // Default password
      signInProviders: ['password'],
    });

    createdPlayers.push(player);
    console.log(`✅ Created player: ${player.fullName} (${player._id})`);
  }

  return createdPlayers;
}

async function assignPlayersToSession(sessionId, playerIds) {
  console.log('\n🎯 Assigning players to session...');

  const session = await Session.findById(sessionId);
  if (!session) {
    console.error('❌ Session not found with ID:', sessionId);
    return;
  }

  console.log(`✅ Found session: ${session.title}`);

  // Get existing player IDs in the session
  const existingPlayerIds = session.assignedPlayers.map(ap => ap.player.toString());

  // Add only new players
  const newPlayers = playerIds.filter(id => !existingPlayerIds.includes(id.toString()));

  if (newPlayers.length === 0) {
    console.log('⚠️  All players already assigned to this session');
    return;
  }

  newPlayers.forEach(playerId => {
    session.assignedPlayers.push({
      player: playerId,
      status: 'confirmed',
      joinedAt: new Date(),
    });
  });

  await session.save();

  console.log(`✅ Assigned ${newPlayers.length} new players to session "${session.title}"`);
  console.log(`   Total players in session: ${session.assignedPlayers.length}/${session.capacity}`);
}

async function main() {
  try {
    console.log('🚀 Starting seeding process...\n');

    await connectDB();

    // Seed sessions for coach
    const sessions = await seedCoachSessions();

    // Seed players for guardian
    const players = await seedGuardianPlayers();

    // Assign players to the specified session (or first created session if ID not found)
    if (players.length > 0) {
      const playerIds = players.map(p => p._id);
      
      // Try the specified session first
      let targetSessionId = SESSION_ID;
      const targetSession = await Session.findById(SESSION_ID);
      
      // If specified session doesn't exist, use the first newly created session
      if (!targetSession && sessions.length > 0) {
        targetSessionId = sessions[0]._id;
        console.log(`⚠️  Specified session not found. Using first created session instead: ${targetSessionId}`);
      }
      
      if (targetSessionId) {
        await assignPlayersToSession(targetSessionId, playerIds);
      }
    }

    console.log('\n✨ Seeding completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Created ${sessions.length} sessions`);
    console.log(`   - Created/Found ${players.length} players`);
    if (sessions.length > 0) {
      console.log(`\n📝 Session IDs created:`);
      sessions.forEach(s => console.log(`   - ${s.title}: ${s._id}`));
    }
    if (players.length > 0) {
      console.log(`\n👥 Player IDs created:`);
      players.forEach(p => console.log(`   - ${p.fullName}: ${p._id}`));
    }

  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

main();
