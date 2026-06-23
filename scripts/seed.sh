#!/bin/bash
# Seed initial data into TravelBuddy database

echo "🌱 Seeding TravelBuddy Database..."

# Run inline Node script
node -e "
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./src/models/User');
const Transaction = require('./src/models/Transaction');
const Analytics = require('./src/models/Analytics');

async function seed() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/travelbot';
    console.log('Connecting to', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // 1. Seed Premium Test User
    const { hashPhoneNumber } = require('./src/utils/security');
    const testPhoneHash = hashPhoneNumber('919999999999');
    await User.deleteMany({ phoneHash: testPhoneHash });
    const user = await User.create({
      phoneHash: testPhoneHash,
      displayName: 'Test Premium User',
      language: 'en',
      subscription: {
        plan: 'premium',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        tripsRemaining: null
      }
    });
    user.generateReferralCode();
    await user.save();
    console.log('✅ Seeded premium test user (Phone: 919999999999)');

    // 2. Seed Mock Transactions
    await Transaction.deleteMany({ userPhoneHash: testPhoneHash });
    await Transaction.create([
      {
        userPhoneHash: testPhoneHash,
        razorpayPaymentLinkId: 'plink_test001',
        razorpayPaymentId: 'pay_test001',
        plan: 'premium',
        amount: 24900,
        status: 'captured',
        completedAt: new Date()
      }
    ]);
    console.log('✅ Seeded mock transactions');

    // 3. Seed Mock Analytics for Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await Analytics.deleteMany({ date: today });
    await Analytics.create({
      date: today,
      totalMessages: 42,
      totalUsers: 1,
      newUsers: 1,
      totalTrips: 3,
      popularDestinations: [{ name: 'goa', count: 2 }, { name: 'manali', count: 1 }],
      popularServices: [{ name: 'hotels', count: 2 }, { name: 'itinerary', count: 1 }],
      avgResponseTime: 450,
      errorCount: 0,
      revenue: 24900 // in paise
    });
    console.log('✅ Seeded mock analytics');

    console.log('🌱 Seeding Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
"
