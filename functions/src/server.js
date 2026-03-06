import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

const startServer = async () => {
    try {
        if (!MONGO_URI) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }
        
        await connectDB(MONGO_URI);
        console.log("✅ MongoDB connected successfully");
        
        app.listen(PORT, () => {
            console.log(`🔵 Server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    }
}

startServer();