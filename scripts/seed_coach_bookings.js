
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const MONGO_URI = "mongodb://burl_sport_db_user:vW8sL2G0kvJz1amA@ac-jwukv2d-shard-00-00.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-01.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-02.onnwqfl.mongodb.net:27017/burlsportdevdb?ssl=true&replicaSet=atlas-grdbw8-shard-0&authSource=admin&retryWrites=true&w=majority";

async function main() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const targetCoachId = "696e5c675c6c0d1d13854469";

        // 1. Find the 'Bowling' Session
        const sessionsCollection = mongoose.connection.collection('sessions');
        let session = await sessionsCollection.findOne({
            coach: new mongoose.Types.ObjectId(targetCoachId),
            title: { $regex: /bowling/i }
        });

        if (!session) {
            console.error('Session not found! Please create a session titled "Bowling" for this coach first.');
            return;
        }

        // 2. Publish the session if draft
        if (session.status !== 'published') {
            console.log('Publishing session...');
            await sessionsCollection.updateOne(
                { _id: session._id },
                { $set: { status: 'published' } }
            );
            session.status = 'published';
        }

        const sessionId = session._id.toString();
        // Use first time slot
        const timeSlot = session.timeSlots[0];
        const occurrenceDate = timeSlot.startTime;

        console.log(`Using Session: ${session.title} (${sessionId}) at ${occurrenceDate}`);

        // 3. Create Seed Users for Players
        const usersCollection = mongoose.connection.collection('users');
        const profilesCollection = mongoose.connection.collection('playerprofiles');
        const bookingsCollection = mongoose.connection.collection('bookings');
        const earningsCollection = mongoose.connection.collection('earnings');

        const seedPlayers = [
            { name: 'John Doe Seeds', email: `seed_john_${Date.now()}@test.com` },
            { name: 'Jane Smith Seeds', email: `seed_jane_${Date.now()}@test.com` },
            { name: 'Mike Brown Seeds', email: `seed_mike_${Date.now()}@test.com` }
        ];

        for (const p of seedPlayers) {
            // Create User
            const userId = new mongoose.Types.ObjectId();
            await usersCollection.insertOne({
                _id: userId,
                fullName: p.name,
                email: p.email,
                role: 'player',
                firebaseUid: `seed_${uuidv4()}`,
                signInProviders: ['password'],
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Create Player Profile
            const profileId = new mongoose.Types.ObjectId();
            await profilesCollection.insertOne({
                _id: profileId,
                userId: userId,
                role: 'player',
                isSelfManaged: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Link Profile to User
            await usersCollection.updateOne({ _id: userId }, { $set: { playerProfile: profileId } });

            console.log(`Created Seed Player: ${p.name}`);

            // 4. Create Booking
            const bookingId = new mongoose.Types.ObjectId();
            const booking = {
                _id: bookingId,
                player: profileId,   // Correct: Profile ID
                session: session._id,
                occurrenceDate: occurrenceDate,
                paymentMethod: 'test_seed',
                pricing: {
                    sessionFee: 60,
                    serviceFee: 2.5,
                    tax: 0,
                    discount: 0,
                    total: 62.5
                },
                status: 'confirmed',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await bookingsCollection.insertOne(booking);
            console.log(`- Booking Created: ${bookingId}`);

            // 5. Create Earning
            // We use the fixed model logic directly here (User ID for player)
            // Coach ID handling: check strict population logic from controller
            const coachIdReal = session.coach._id || session.coach; // Handle both populated/unpopulated

            const earningId = new mongoose.Types.ObjectId();
            const earning = {
                _id: earningId,
                coach: new mongoose.Types.ObjectId(targetCoachId), // Ensure clean ObjectId
                session: session._id,
                booking: bookingId,
                player: userId, // User ID who paid
                amount: 62.5,
                sessionTitle: session.title,
                sessionDate: occurrenceDate, // Date object
                sessionType: 'one-on-one',
                status: 'confirmed',
                currency: 'USD',
                netAmount: 62.5,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await earningsCollection.insertOne(earning);
            console.log(`- Earning Created: ${earningId}`);
        }

        console.log('\nSeed Complete!');

    } catch (err) {
        console.error('Script error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
