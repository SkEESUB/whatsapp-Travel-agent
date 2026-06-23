// User Service
// User management, preferences, and subscription handling

const User = require('../models/User');
const Analytics = require('../models/Analytics');
const { hashPhoneNumber } = require('../utils/security');
const logger = require('../config/logger');

/**
 * Find or create user by phone number
 */
async function findOrCreateUser(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    let user = await User.findOne({ phoneHash }).lean();
    
    if (!user) {
      // Create new user
      const newUser = await User.create({ phoneHash });
      user = newUser.toObject();
      
      // Generate referral code
      const userDoc = await User.findById(user._id);
      userDoc.generateReferralCode();
      await userDoc.save();
      
      user = userDoc.toObject();
      
      logger.info('New user created', {
        phoneNumber: hashPhoneNumber(phoneNumber).substring(0, 10) + '...',
        referralCode: user.referral.code,
      });
    }
    
    return user;
  } catch (error) {
    logger.error('Failed to find or create user', {
      error: error.message,
      phoneNumber: hashPhoneNumber(phoneNumber).substring(0, 10) + '...',
    });
    throw error;
  }
}

/**
 * Update user's last activity timestamp
 */
async function updateUserActivity(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const user = await User.findOneAndUpdate(
      { phoneHash },
      {
        $set: { lastActiveAt: new Date() },
        $inc: { totalMessages: 1 },
      },
      { new: true, lean: true }
    );
    
    // Track in analytics
    const today = await Analytics.getToday();
    await today.incrementMessages();
    
    return user;
  } catch (error) {
    logger.error('Failed to update user activity', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get user preferences
 */
async function getUserPreferences(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const user = await User.findOne({ phoneHash })
      .select('preferences language subscription')
      .lean();
    
    if (!user) {
      return null;
    }
    
    return {
      language: user.language,
      preferences: user.preferences,
      subscription: user.subscription,
    };
  } catch (error) {
    logger.error('Failed to get user preferences', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Update user preferences
 */
async function updatePreferences(phoneNumber, prefs) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const updateData = {};
    
    if (prefs.language) {
      updateData.language = prefs.language;
    }
    
    if (prefs.travelStyle) {
      updateData['preferences.travelStyle'] = prefs.travelStyle;
    }
    
    if (prefs.budgetRange) {
      updateData['preferences.budgetRange'] = prefs.budgetRange;
    }
    
    if (prefs.dietaryPreference) {
      updateData['preferences.dietaryPreference'] = prefs.dietaryPreference;
    }
    
    const user = await User.findOneAndUpdate(
      { phoneHash },
      { $set: updateData },
      { new: true, lean: true }
    );
    
    logger.info('User preferences updated', {
      phoneNumber: phoneHash.substring(0, 10) + '...',
      updates: Object.keys(updateData),
    });
    
    return user;
  } catch (error) {
    logger.error('Failed to update preferences', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Check user's subscription status and limits
 */
async function checkSubscription(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const user = await User.findOne({ phoneHash })
      .select('subscription totalTrips isBlocked')
      .lean();
    
    if (!user) {
      return {
        plan: 'free',
        isActive: false,
        tripsRemaining: 0,
        canCreateTrip: false,
      };
    }
    
    const isSubscriptionActive = user.subscription.plan !== 'free' && 
      (!user.subscription.expiresAt || new Date() < user.subscription.expiresAt);
    
    const tripsRemaining = user.subscription.tripsRemaining === null 
      ? null // Unlimited
      : user.subscription.tripsRemaining;
    
    const canCreateTrip = !user.isBlocked && 
      (tripsRemaining === null || tripsRemaining > 0);
    
    return {
      plan: user.subscription.plan,
      isActive: isSubscriptionActive,
      tripsRemaining,
      totalTrips: user.totalTrips,
      canCreateTrip,
      isBlocked: user.isBlocked,
    };
  } catch (error) {
    logger.error('Failed to check subscription', {
      error: error.message,
    });
    return {
      plan: 'free',
      isActive: false,
      tripsRemaining: 0,
      canCreateTrip: false,
      isBlocked: false,
    };
  }
}

/**
 * Increment user's trip count
 */
async function incrementTripCount(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const user = await User.findOneAndUpdate(
      { phoneHash },
      {
        $inc: {
          totalTrips: 1,
          'subscription.tripsRemaining': -1,
        },
        $set: { lastActiveAt: new Date() },
      },
      { new: true, lean: true }
    );
    
    logger.info('Trip count incremented', {
      phoneNumber: phoneHash.substring(0, 10) + '...',
      totalTrips: user?.totalTrips,
    });
    
    return user;
  } catch (error) {
    logger.error('Failed to increment trip count', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Add destination to user's favorites
 */
async function addFavoriteDestination(phoneNumber, destination) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    const dest = destination.toLowerCase().trim();
    
    const user = await User.findOneAndUpdate(
      { phoneHash },
      {
        $addToSet: { 'preferences.favoriteDestinations': dest },
        $set: { lastActiveAt: new Date() },
      },
      { new: true, lean: true }
    );
    
    return user;
  } catch (error) {
    logger.error('Failed to add favorite destination', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get user by phone number
 */
async function getUser(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    return await User.findOne({ phoneHash }).lean();
  } catch (error) {
    logger.error('Failed to get user', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Block user
 */
async function blockUser(phoneNumber, reason) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const user = await User.findOneAndUpdate(
      { phoneHash },
      {
        $set: {
          isBlocked: true,
          blockedReason: reason,
        },
      },
      { new: true, lean: true }
    );
    
    logger.warn('User blocked', {
      phoneNumber: phoneHash.substring(0, 10) + '...',
      reason,
    });
    
    return user;
  } catch (error) {
    logger.error('Failed to block user', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Unblock user
 */
async function unblockUser(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const user = await User.findOneAndUpdate(
      { phoneHash },
      {
        $set: {
          isBlocked: false,
          blockedReason: undefined,
        },
      },
      { new: true, lean: true }
    );
    
    logger.info('User unblocked', {
      phoneNumber: phoneHash.substring(0, 10) + '...',
    });
    
    return user;
  } catch (error) {
    logger.error('Failed to unblock user', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get user statistics
 */
async function getUserStats(phoneNumber) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    const user = await User.findOne({ phoneHash })
      .select('totalTrips totalMessages joinedAt lastActiveAt preferences')
      .lean();
    
    if (!user) {
      return null;
    }
    
    const daysSinceJoined = Math.floor(
      (Date.now() - user.joinedAt) / (1000 * 60 * 60 * 24)
    );
    
    return {
      totalTrips: user.totalTrips,
      totalMessages: user.totalMessages,
      joinedAt: user.joinedAt,
      lastActiveAt: user.lastActiveAt,
      daysSinceJoined,
      preferences: user.preferences,
    };
  } catch (error) {
    logger.error('Failed to get user stats', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get user by phone number (wrapper for getUser)
 */
async function getUserByPhone(phoneNumber) {
  return getUser(phoneNumber);
}

/**
 * Create a new user with custom data
 */
async function createUser(phoneNumber, data = {}) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    
    // Merge base data with subscription
    const userDoc = new User({
      phoneHash,
      ...data,
    });
    
    userDoc.generateReferralCode();
    await userDoc.save();
    
    return userDoc.toObject();
  } catch (error) {
    logger.error('Failed to create user', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Update user subscription details
 */
async function updateUserSubscription(phoneNumber, subscriptionData) {
  try {
    const phoneHash = hashPhoneNumber(phoneNumber);
    const { plan, expiresAt, tripsRemaining } = subscriptionData;
    
    const user = await User.findOneAndUpdate(
      { phoneHash },
      {
        $set: {
          'subscription.plan': plan,
          'subscription.expiresAt': expiresAt,
          'subscription.tripsRemaining': tripsRemaining,
        },
      },
      { new: true }
    );
    
    if (user) {
      logger.info('User subscription updated in database', {
        phoneNumber: phoneHash.substring(0, 10) + '...',
        plan,
        expiresAt,
        tripsRemaining,
      });
      return user.toObject();
    }
    
    return null;
  } catch (error) {
    logger.error('Failed to update user subscription', {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  findOrCreateUser,
  updateUserActivity,
  getUserPreferences,
  updatePreferences,
  checkSubscription,
  incrementTripCount,
  addFavoriteDestination,
  getUser,
  getUserByPhone,
  createUser,
  updateUserSubscription,
  blockUser,
  unblockUser,
  getUserStats,
};

