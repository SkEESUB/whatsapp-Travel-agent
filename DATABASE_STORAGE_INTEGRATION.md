# Permanent Data Storage System - Integration Guide

## Overview
This guide explains how to integrate MongoDB-based permanent data storage into your WhatsApp Travel Bot for user management, trip tracking, and analytics.

**Benefits**:
- ✅ Permanent user profiles (survives restarts)
- ✅ Complete trip history
- ✅ User preferences & subscriptions
- ✅ Referral system
- ✅ Real-time analytics
- ✅ Performance monitoring
- ✅ Revenue tracking

---

## Files Created

### 1. `src/config/database.js` (222 lines)
MongoDB connection management:
- Auto-reconnect on failure
- Connection pool: 10
- Graceful shutdown
- Connection status monitoring
- Database statistics

### 2. `src/models/User.js` (281 lines)
User schema with:
- Phone hash (privacy)
- Language preference
- Subscription management (free/basic/premium)
- Travel preferences
- Referral system
- Activity tracking
- Block/unblock functionality

### 3. `src/models/Trip.js` (277 lines)
Trip schema with:
- Complete trip details
- Services used tracking
- Status management (planning/completed/cancelled)
- User feedback (rating + comment)
- Popular destinations aggregation
- Trip statistics

### 4. `src/models/Analytics.js` (281 lines)
Daily analytics schema:
- Message tracking
- User metrics
- Trip metrics
- Popular destinations/services
- Response time tracking
- Error counting
- Revenue tracking

### 5. `src/services/userService.js` (385 lines)
User management functions:
- `findOrCreateUser(phoneNumber)`
- `updateUserActivity(phoneNumber)`
- `getUserPreferences(phoneNumber)`
- `updatePreferences(phoneNumber, prefs)`
- `checkSubscription(phoneNumber)`
- `incrementTripCount(phoneNumber)`
- `addFavoriteDestination(phoneNumber, destination)`
- `blockUser(phoneNumber, reason)`
- `getUserStats(phoneNumber)`

### 6. `src/services/tripService.js` (380 lines)
Trip management functions:
- `createTrip(phoneNumber, tripData)`
- `updateTrip(tripId, data)`
- `addServiceUsed(tripId, service)`
- `completeTrip(tripId)`
- `cancelTrip(tripId)`
- `getUserTrips(phoneNumber, options)`
- `addFeedback(tripId, rating, comment)`
- `getUserTripStats(phoneNumber)`

### 7. `src/services/analyticsService.js` (340 lines)
Analytics functions:
- `trackMessage(phoneNumber)`
- `trackTrip(destination, services)`
- `trackError()`
- `trackResponseTime(responseTime)`
- `getDailyStats(date)`
- `getPopularDestinations(days)`
- `getRevenue(startDate, endDate)`
- `getDashboardData()`

---

## Installation

### 1. Install Dependencies
```bash
npm install mongoose
```

### 2. Set Environment Variable
```bash
# .env
MONGODB_URI=mongodb://localhost:27017/travelbot
# OR for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/travelbot
```

---

## Integration: Update app.js

### Add Database Connection

```javascript
// src/app.js

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const logger = require('./config/logger');
const database = require('./config/database');

const app = express();

// ... middleware ...

// Connect to MongoDB
async function startServer() {
  try {
    // Connect to MongoDB
    await database.connect();
    logger.info('✅ MongoDB connected');
    
    // Start server
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Shutting down...');
      await database.disconnect();
      server.close(() => process.exit(0));
    });
    
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

startServer();
```

---

## Integration: Update webhookController.js

### Track Users and Trips

```javascript
// src/controllers/webhookController.js

const userService = require('../services/userService');
const tripService = require('../services/tripService');
const analyticsService = require('../services/analyticsService');
const { sanitizeForAI } = require('../utils/security');

class WebhookController {
  
  async receiveMessage(req, res) {
    try {
      const from = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
      const text = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
      
      if (!from || !text) {
        return res.status(200).json({ status: 'ok' });
      }
      
      const sanitizedText = sanitizeForAI(text);
      
      // Track user activity
      await userService.updateUserActivity(from);
      
      // Track message in analytics
      await analyticsService.trackMessage(from);
      
      // Add to queue for processing
      await messageQueue.addMessageToQueue(from, sanitizedText);
      
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error('Webhook error', { error: error.message });
      return res.status(200).json({ status: 'error' });
    }
  }
  
  async handleMenuInput(from, text, session) {
    const parsed = parseTripDetails(text);
    
    if (parsed.confidence >= 50 && parsed.destination) {
      // Create trip in database
      const trip = await tripService.createTrip(from, {
        destination: parsed.destination,
        source: parsed.source,
        days: parsed.days,
        budget: parsed.budget,
        people: parsed.people,
        travelStyle: parsed.preferences?.[0] || '',
      });
      
      // Track in analytics
      await analyticsService.trackTrip(parsed.destination);
      
      // Increment user's trip count
      await userService.incrementTripCount(from);
      
      // Add favorite destination
      await userService.addFavoriteDestination(from, parsed.destination);
      
      return getTripConfirmationMessage(trip);
    }
    
    return getFallbackMessage();
  }
  
  async handleHotels(from, session) {
    if (!session.tripData?.destination) {
      return '❌ Please plan a trip first.';
    }
    
    // Add service to trip
    if (session.currentTripId) {
      await tripService.addServiceUsed(session.currentTripId, 'hotels');
    }
    
    // ... rest of hotel logic
  }
  
  async handleItinerary(from, session) {
    if (session.currentTripId) {
      await tripService.addServiceUsed(session.currentTripId, 'itinerary');
    }
    
    // ... rest of itinerary logic
  }
}
```

---

## Database Indexes (Performance)

All models include optimized indexes:

### User Indexes
```javascript
userSchema.index({ phoneHash: 1 });          // Unique lookup
userSchema.index({ joinedAt: -1 });          // Sort by join date
userSchema.index({ lastActiveAt: -1 });      // Active users
userSchema.index({ 'subscription.plan': 1 }); // Filter by plan
userSchema.index({ totalTrips: -1 });        // Top users
```

### Trip Indexes
```javascript
tripSchema.index({ userPhoneHash: 1 });      // User's trips
tripSchema.index({ destination: 1 });        // Popular destinations
tripSchema.index({ status: 1 });             // Filter by status
tripSchema.index({ createdAt: -1 });         // Recent trips
tripSchema.index({ userPhoneHash: 1, status: 1 }); // Compound
```

### Analytics Indexes
```javascript
analyticsSchema.index({ date: 1 });          // Unique daily docs
analyticsSchema.index({ date: -1 });         // Sort by date
```

---

## Usage Examples

### Create User
```javascript
const userService = require('./src/services/userService');

// Find or create user
const user = await userService.findOrCreateUser('919876543210');
console.log(user);

// Update preferences
await userService.updatePreferences('919876543210', {
  travelStyle: 'adventure',
  budgetRange: 'mid',
  language: 'en',
});

// Check subscription
const subscription = await userService.checkSubscription('919876543210');
console.log(subscription);
// { plan: 'free', isActive: false, tripsRemaining: 0, canCreateTrip: true }
```

### Create Trip
```javascript
const tripService = require('./src/services/tripService');

// Create trip
const trip = await tripService.createTrip('919876543210', {
  destination: 'Goa',
  source: 'Mumbai',
  days: 3,
  budget: 15000,
  people: 2,
  travelStyle: 'beach',
});

console.log(trip);
// {
//   _id: "...",
//   userPhoneHash: "...",
//   destination: 'goa',
//   days: 3,
//   budget: 15000,
//   people: 2,
//   status: 'planning',
//   servicesUsed: [],
//   createdAt: "..."
// }

// Add service used
await tripService.addServiceUsed(trip._id, 'hotels');
await tripService.addServiceUsed(trip._id, 'itinerary');

// Complete trip
await tripService.completeTrip(trip._id);

// Add feedback
await tripService.addFeedback(trip._id, 5, 'Amazing trip!');
```

### Get Analytics
```javascript
const analyticsService = require('./src/services/analyticsService');

// Get today's stats
const today = await analyticsService.getDailyStats();
console.log(today);

// Get last 7 days
const last7Days = await analyticsService.getLastNDaysStats(7);

// Get popular destinations
const popular = await analyticsService.getPopularDestinations(30, 10);
console.log(popular);
// [
//   { name: 'goa', count: 45, avgBudget: 12000, avgDays: 3 },
//   { name: 'manali', count: 30, avgBudget: 15000, avgDays: 4 },
//   ...
// ]

// Get dashboard data
const dashboard = await analyticsService.getDashboardData();
console.log(dashboard);
```

---

## Schema Validations

### User Validation
```javascript
{
  phoneHash: String (required, unique, indexed),
  language: 'en' | 'hi' | 'te' | 'ta' | ...,
  subscription.plan: 'free' | 'basic' | 'premium',
  preferences.travelStyle: 'adventure' | 'relaxing' | ...,
  preferences.budgetRange: 'budget' | 'mid' | 'premium' | 'luxury',
  preferences.dietaryPreference: 'veg' | 'non-veg' | 'vegan' | 'jain',
}
```

### Trip Validation
```javascript
{
  destination: String (required, max 100 chars),
  days: Number (required, min 1, max 365),
  budget: Number (required, min 0),
  people: Number (required, min 1, max 100),
  travelStyle: 'adventure' | 'relaxing' | ...,
  status: 'planning' | 'completed' | 'cancelled',
  feedback.rating: Number (min 1, max 5),
}
```

---

## Performance Optimizations

### Use lean() Queries
```javascript
// ❌ BAD: Returns full Mongoose documents
const users = await User.find({});

// ✅ GOOD: Returns plain JavaScript objects (faster, less memory)
const users = await User.find({}).lean();
```

### Select Only Needed Fields
```javascript
// ❌ BAD: Returns all fields
const user = await User.findOne({ phoneHash });

// ✅ GOOD: Returns only needed fields
const user = await User.findOne({ phoneHash })
  .select('preferences subscription')
  .lean();
```

### Use Aggregation for Complex Queries
```javascript
// Get popular destinations with stats
const popular = await Trip.aggregate([
  { $match: { createdAt: { $gte: since } } },
  { $group: {
      _id: '$destination',
      count: { $sum: 1 },
      avgBudget: { $avg: '$budget' },
  }},
  { $sort: { count: -1 } },
  { $limit: 10 },
]).lean();
```

---

## Monitoring

### Database Connection Status
```javascript
const database = require('./src/config/database');

// Check connection
const status = database.getConnectionStatus();
console.log(status);
// { connected: true, state: 'connected', host: 'localhost', ... }

// Test connection
const test = await database.testConnection();
console.log(test);
// { success: true }

// Get database stats
const stats = await database.getDatabaseStats();
console.log(stats);
// { collections: [...], totalSize: 1234567 }
```

### Analytics Dashboard Endpoint
```javascript
// Add to app.js
app.get('/admin/dashboard', async (req, res) => {
  try {
    const data = await analyticsService.getDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/admin/users/:phoneNumber/stats', async (req, res) => {
  try {
    const stats = await userService.getUserStats(req.params.phoneNumber);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## Referral System

### Generate Referral Code
```javascript
const user = await userService.findOrCreateUser('919876543210');
console.log(user.referral.code); // "TRVLA1B3F4E"
```

### Track Referrals
```javascript
// When new user signs up with referral code
const newUser = await User.create({
  phoneHash: hashPhoneNumber('919876543211'),
  referral: {
    referredBy: 'TRVLA1B3F4E', // Existing user's code
  },
});

// Increment referrer's count
await User.findOneAndUpdate(
  { 'referral.code': 'TRVLA1B3F4E' },
  { $inc: { 'referral.referralCount': 1 } }
);
```

---

## Subscription Management

### Check Subscription Limits
```javascript
const subscription = await userService.checkSubscription('919876543210');

if (!subscription.canCreateTrip) {
  if (subscription.isBlocked) {
    return '❌ Your account has been blocked.';
  }
  
  if (subscription.tripsRemaining === 0) {
    return '❌ You have used all your trips. Upgrade to premium!';
  }
}
```

### Upgrade Subscription
```javascript
const userDoc = await User.findOne({ phoneHash });

await userDoc.upgradeSubscription(
  'premium',
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  null // Unlimited trips
);
```

---

## Testing

### Test Database Connection
```bash
# Start MongoDB
mongod

# Test connection
node -e "
const database = require('./src/config/database');
(async () => {
  await database.connect();
  const status = database.getConnectionStatus();
  console.log(status);
})();
"
```

### Test User Service
```bash
node -e "
const userService = require('./src/services/userService');
(async () => {
  const user = await userService.findOrCreateUser('919876543210');
  console.log('User:', user);
  
  const prefs = await userService.getUserPreferences('919876543210');
  console.log('Preferences:', prefs);
})();
"
```

### Test Trip Service
```bash
node -e "
const tripService = require('./src/services/tripService');
(async () => {
  const trip = await tripService.createTrip('919876543210', {
    destination: 'Goa',
    days: 3,
    budget: 15000,
    people: 2,
  });
  console.log('Trip:', trip);
  
  const trips = await tripService.getUserTrips('919876543210');
  console.log('User trips:', trips.length);
})();
"
```

---

## Summary

### Database Structure

```
travelbot (database)
├── users (collection)
│   ├── phoneHash (indexed, unique)
│   ├── preferences
│   ├── subscription
│   └── referral
│
├── trips (collection)
│   ├── userPhoneHash (indexed)
│   ├── destination (indexed)
│   ├── status (indexed)
│   ├── servicesUsed
│   └── feedback
│
└── analytics (collection)
    ├── date (indexed, unique)
    ├── totalMessages
    ├── popularDestinations
    └── popularServices
```

### Key Features

- ✅ **Permanent storage**: Data survives restarts
- ✅ **Performance**: Optimized indexes, lean() queries
- ✅ **Validation**: Schema-level validation
- ✅ **Privacy**: Phone hashing, PII protection
- ✅ **Scalability**: Connection pooling, aggregation
- ✅ **Analytics**: Real-time tracking and reporting
- ✅ **Monitoring**: Dashboard endpoints

**Your bot now has enterprise-grade data storage!** 🚀📊
