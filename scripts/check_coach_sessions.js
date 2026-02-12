
import mongoose from 'mongoose';

const MONGO_URI = "mongodb://burl_sport_db_user:vW8sL2G0kvJz1amA@ac-jwukv2d-shard-00-00.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-01.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-02.onnwqfl.mongodb.net:27017/burlsportdevdb?ssl=true&replicaSet=atlas-grdbw8-shard-0&authSource=admin&retryWrites=true&w=majority";

async function main() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const targetCoachId = "696e5c675c6c0d1d13854469";

        // Check Coach
        const user = await mongoose.connection.collection('users').findOne({
            _id: new mongoose.Types.ObjectId(targetCoachId)
        });

        if (!user) {
            console.error('Coach not found!');
            return;
        }
        console.log(`Found Coach: ${user.fullName} (${user._id})`);
        console.log(`Email: ${user.email}`);

        // Check Sessions
        const sessions = await mongoose.connection.collection('sessions').find({
            coach: new mongoose.Types.ObjectId(targetCoachId)
        }).toArray();

        console.log(`Found ${sessions.length} sessions.`);

        sessions.forEach(s => {
            console.log(`- Session: ${s.title}, Status: ${s.status}, Type: ${s.isRecurring ? 'Recurring' : 'Single'}`);
            console.log(`  TimeSlots: ${s.timeSlots?.length || 0}`);
            if (s.timeSlots && s.timeSlots.length > 0) {
                console.log(`  First Slot: ${s.timeSlots[0].startTime}`);
            }
        });

    } catch (err) {
        console.error('Script error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
