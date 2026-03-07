// src/scripts/seed-promo-codes.js
// Run with: node --experimental-vm-modules src/scripts/seed-promo-codes.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PromoCode from '../models/PromoCode.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in .env');
  process.exit(1);
}

const TEST_PROMOS = [
  {
    name: 'Summer 10% Off',
    code: 'SUMMER10',
    category: 'booking',
    discountType: 'percentage',
    discountValue: 10,
    minimumPrice: 0,
    startDate: new Date('2024-01-01'),
    duration: 5,
    durationUnit: 'years',
    usageLimitEnabled: false,
    status: 'active',
  },
  {
    name: 'Cricket $10 Off',
    code: 'CRICKET10',
    category: 'booking',
    discountType: 'fixed',
    discountValue: 10,
    minimumPrice: 0,
    startDate: new Date('2024-01-01'),
    duration: 5,
    durationUnit: 'years',
    usageLimitEnabled: false,
    status: 'active',
  },
  {
    name: 'Test 50% Off',
    code: 'TEST50',
    category: 'booking',
    discountType: 'percentage',
    discountValue: 50,
    minimumPrice: 0,
    startDate: new Date('2024-01-01'),
    duration: 5,
    durationUnit: 'years',
    usageLimitEnabled: false,
    status: 'active',
  },
];

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    for (const promo of TEST_PROMOS) {
      const exists = await PromoCode.findOne({ code: promo.code });
      if (exists) {
        // Reactivate if expired/disabled
        if (exists.status !== 'active') {
          exists.status = 'active';
          await exists.save();
          console.log(`♻️  Reactivated promo code: ${promo.code}`);
        } else {
          console.log(`ℹ️  Promo code already active: ${promo.code}`);
        }
      } else {
        await PromoCode.create(promo);
        console.log(`✅ Created promo code: ${promo.code}`);
      }
    }

    console.log('\n🎉 Done! Active test promo codes:');
    console.log('  SUMMER10  — 10% off any session');
    console.log('  CRICKET10 — $10 off any session');
    console.log('  TEST50    — 50% off any session\n');
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seed();
