// User Model
// Permanent user storage with preferences, subscription, and referral tracking

const mongoose = require('mongoose');
const crypto = require('crypto');

// User schema
const userSchema = new mongoose.Schema({
  // Phone number hash (for privacy)
  phoneHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  
  // Display name (optional)
  displayName: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  
  // Language preference
  language: {
    type: String,
    enum: ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'gu', 'pa', 'bn'],
    default: 'en',
  },
  
  // Timestamps
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
  
  // Activity tracking
  totalTrips: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  totalMessages: {
    type: Number,
    default: 0,
    min: 0,
  },
  
  // Subscription
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free',
    },
    expiresAt: {
      type: Date,
    },
    tripsRemaining: {
      type: Number,
      default: null, // null = unlimited
    },
  },
  
  // User preferences
  preferences: {
    travelStyle: {
      type: String,
      enum: ['adventure', 'relaxing', 'religious', 'romantic', 'historical', 'nature', 'party', ''],
      default: '',
    },
    budgetRange: {
      type: String,
      enum: ['budget', 'mid', 'premium', 'luxury', ''],
      default: '',
    },
    favoriteDestinations: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    dietaryPreference: {
      type: String,
      enum: ['veg', 'non-veg', 'vegan', 'jain', ''],
      default: '',
    },
  },
  
  // Referral system
  referral: {
    code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    referredBy: {
      type: String,
      trim: true,
    },
    referralCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  
  // Account status
  isBlocked: {
    type: Boolean,
    default: false,
  },
  
  blockedReason: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Indexes for performance
userSchema.index({ joinedAt: -1 });
userSchema.index({ lastActiveAt: -1 });
userSchema.index({ 'subscription.plan': 1 });
// Note: referral.code index is auto-created by unique: true
userSchema.index({ totalTrips: -1 });

// Virtual: Days since joined
userSchema.virtual('daysSinceJoined').get(function() {
  const now = new Date();
  const diff = now - this.joinedAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Virtual: Is subscription active
userSchema.virtual('isSubscriptionActive').get(function() {
  if (this.subscription.plan === 'free') return false;
  if (!this.subscription.expiresAt) return true;
  return new Date() < this.subscription.expiresAt;
});

// Virtual: Can create more trips
userSchema.virtual('canCreateTrip').get(function() {
  if (this.isBlocked) return false;
  if (this.subscription.tripsRemaining === null) return true; // Unlimited
  return this.subscription.tripsRemaining > 0;
});

// Method: Generate referral code
userSchema.methods.generateReferralCode = function() {
  if (!this.referral.code) {
    // Generate unique code: first 3 chars of phone hash + random 4 chars
    const phonePrefix = this.phoneHash.substring(0, 3).toUpperCase();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    this.referral.code = `TRVL${phonePrefix}${random}`;
  }
  return this.referral.code;
};

// Method: Increment message count
userSchema.methods.incrementMessageCount = async function() {
  this.totalMessages += 1;
  this.lastActiveAt = new Date();
  return this.save();
};

// Method: Increment trip count
userSchema.methods.incrementTripCount = async function() {
  this.totalTrips += 1;
  this.lastActiveAt = new Date();
  
  // Decrement remaining trips if limited
  if (this.subscription.tripsRemaining !== null) {
    this.subscription.tripsRemaining = Math.max(0, this.subscription.tripsRemaining - 1);
  }
  
  return this.save();
};

// Method: Add favorite destination
userSchema.methods.addFavoriteDestination = async function(destination) {
  const dest = destination.toLowerCase().trim();
  
  if (!this.preferences.favoriteDestinations.includes(dest)) {
    this.preferences.favoriteDestinations.push(dest);
    
    // Keep only top 10
    if (this.preferences.favoriteDestinations.length > 10) {
      this.preferences.favoriteDestinations = this.preferences.favoriteDestinations.slice(-10);
    }
  }
  
  return this.save();
};

// Method: Update preferences
userSchema.methods.updatePreferences = async function(prefs) {
  if (prefs.travelStyle) this.preferences.travelStyle = prefs.travelStyle;
  if (prefs.budgetRange) this.preferences.budgetRange = prefs.budgetRange;
  if (prefs.dietaryPreference) this.preferences.dietaryPreference = prefs.dietaryPreference;
  
  return this.save();
};

// Method: Block user
userSchema.methods.block = async function(reason) {
  this.isBlocked = true;
  this.blockedReason = reason;
  return this.save();
};

// Method: Unblock user
userSchema.methods.unblock = async function() {
  this.isBlocked = false;
  this.blockedReason = undefined;
  return this.save();
};

// Method: Upgrade subscription
userSchema.methods.upgradeSubscription = async function(plan, expiresAt, tripsRemaining = null) {
  this.subscription.plan = plan;
  this.subscription.expiresAt = expiresAt;
  this.subscription.tripsRemaining = tripsRemaining;
  return this.save();
};

// Static: Find or create user
userSchema.statics.findOrCreate = async function(phoneHash) {
  let user = await this.findOne({ phoneHash }).lean();
  
  if (!user) {
    const newUser = await this.create({ phoneHash });
    user = newUser.toObject();
  }
  
  return user;
};

// Static: Get active users count
userSchema.statics.getActiveUsersCount = async function(days = 1) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return this.countDocuments({ 
    lastActiveAt: { $gte: since },
    isBlocked: false,
  }).lean();
};

// Static: Get users by subscription plan
userSchema.statics.getUsersByPlan = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$subscription.plan',
        count: { $sum: 1 },
      }
    },
    {
      $sort: { count: -1 }
    }
  ]).lean();
};

// Static: Get top referrers
userSchema.statics.getTopReferrers = async function(limit = 10) {
  return this.find({ 'referral.referralCount': { $gt: 0 } })
    .sort({ 'referral.referralCount': -1 })
    .limit(limit)
    .select('phoneHash referral.code referral.referralCount')
    .lean();
};

// Pre-save: Update lastActiveAt
userSchema.pre('save', function(next) {
  this.lastActiveAt = new Date();
  next();
});

// Create model
const User = mongoose.model('User', userSchema);

module.exports = User;
