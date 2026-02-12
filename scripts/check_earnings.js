
import mongoose from 'mongoose';

const MONGO_URI = "mongodb://burl_sport_db_user:vW8sL2G0kvJz1amA@ac-jwukv2d-shard-00-00.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-01.onnwqfl.mongodb.net:27017,ac-jwukv2d-shard-00-02.onnwqfl.mongodb.net:27017/burlsportdevdb?ssl=true&replicaSet=atlas-grdbw8-shard-0&authSource=admin&retryWrites=true&w=majority";

async function main() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Target Coach ID from previous run
        const targetCoachId = "696e5c675c6c0d1d13854469";

        console.log(`Checking earnings for Coach ID: ${targetCoachId}`);

        const earningsCollection = mongoose.connection.collection('earnings');

        // Find ALL earnings for this coach
        // Note: verify if field is 'coach' or 'coachId'
        // Schema says 'coach' (ObjectId)
        const earnings = await earningsCollection.find({
            coach: new mongoose.Types.ObjectId(targetCoachId)
        }).toArray();

        console.log(`Found ${earnings.length} earnings for this coach.`);

        if (earnings.length > 0) {
            console.log('Last 3 earnings:');
            earnings.slice(-3).forEach(e => {
                console.log(`- Amount: ${e.amount}, Date: ${e.sessionDate}, Status: ${e.status}`);
            });
        }

        // Also check if ANY earnings exist in the whole collection
        const count = await earningsCollection.countDocuments();
        console.log(`Total documents in 'earnings' collection: ${count}`);

    } catch (err) {
        console.error('Script error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();
