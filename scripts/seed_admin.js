import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

import Admin from '../src/models/Admin.js';

const MONGO_URI = process.env.MONGO_URI;

async function seedAdmin() {
  if (!MONGO_URI) {
    console.error('MONGO_URI is missing in .env file');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const adminEmail = 'admin@burl.com';
    const adminPassword = 'QbN56r89nm2Vn9xC3qr';
    const adminName = 'System Admin';

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`Admin user with email ${adminEmail} already exists.`);
      console.log('Updating password to ensure it matches...');
      existingAdmin.password = adminPassword;
      await existingAdmin.save();
      console.log('Password updated successfully.');
      process.exit(0);
    }

    // Create new admin
    const newAdmin = new Admin({
      email: adminEmail,
      password: adminPassword,
      fullName: adminName,
      role: 'superadmin',
      isActive: true,
    });

    await newAdmin.save();
    console.log(`\n✅ Admin seeded successfully!`);
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log(`Role: superadmin\n`);

  } catch (err) {
    console.error('Error seeding admin:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

seedAdmin();
