// src/scripts/seed-admin.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env');
  process.exit(1);
}

const seedAdmin = async () => {
  let connection;

  try {
    connection = await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const existing = await Admin.findOne({ email: 'admin@burl.com' });
    if (existing) {
      console.log('Admin already exists — skipping creation');
      return;
    }

    await Admin.create({
      email: 'admin@burl.com',
      password: 'QbN56r89nm2Vn9xC3qr', // ← CHANGE THIS right after success!
      fullName: 'Burl Admin',
      role: 'superadmin',
    });

    console.log('✅ Admin user created successfully!');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

seedAdmin();