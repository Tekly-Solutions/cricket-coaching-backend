
import mongoose from 'mongoose';

// Hardcoded for testing script to avoid dependency issues
const MONGO_URI = "mongodb://burl_sport_db_user:vW8sL2G0kvJz1amA@ac-jwukv2d-shard-00-00.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-01.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-02.onnwqfl.mongodb.net:27017/burlsportdevdb?ssl=true&replicaSet=atlas-grdbw8-shard-0&authSource=admin&retryWrites=true&w=majority";
const API_URL = 'http://localhost:4000/api';

async function main() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Register User (API)
        const testEmail = `testplayer_${Date.now()}@example.com`;
        const testPassword = 'password123';

        console.log(`Registering user: ${testEmail}`);
        let token;
        let userId;

        const regResponse = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Player Auto',
                email: testEmail,
                password: testPassword,
                role: 'player'
            })
        });

        const regData = await regResponse.json();

        if (!regResponse.ok) {
            console.error('Registration failed:', regData);
            process.exit(1);
        }

        token = regData.token;
        console.log('User registered. Token acquired.');

        // 2. Find a Session (DB)
        const sessionCollection = mongoose.connection.collection('sessions');
        const now = new Date();

        const session = await sessionCollection.findOne({
            status: 'published',
            'timeSlots.startTime': { $gt: now }
        });

        if (!session) {
            console.error('No upcoming published sessions found in DB.');
            process.exit(1);
        }

        console.log(`Found session: ${session.title} (${session._id})`);

        const sessionId = session._id.toString();

        // Find the next occurrence
        const nextOccurrence = session.timeSlots.find(ts => new Date(ts.startTime) > now) || session.timeSlots[0];
        const occurrenceDate = nextOccurrence.startTime;

        console.log(`Booking for date: ${occurrenceDate}`);

        // 3. Create Booking (API)
        const bookResponse = await fetch(`${API_URL}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                sessionId: sessionId,
                occurrenceDate: occurrenceDate,
                paymentMethod: 'test'
            })
        });

        const bookData = await bookResponse.json();

        if (!bookResponse.ok) {
            console.error('Booking failed:', bookData);
        } else {
            console.log('Booking successful!');
            console.log('Booking ID:', bookData.booking._id);

            // 4. Verify Earning (DB Check)
            const earningCollection = mongoose.connection.collection('earnings');
            // Give a small delay for async creation if any (though controller awaits it, so should be immediate)

            const earning = await earningCollection.findOne({
                booking: new mongoose.Types.ObjectId(bookData.booking._id)
            });

            if (earning) {
                console.log('SUCCESS: Earning record created:', earning._id);
                console.log('Amount:', earning.amount);
            } else {
                console.error('FAILURE: Earning record NOT found for this booking.');
            }
        }

    } catch (err) {
        console.error('Script error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
