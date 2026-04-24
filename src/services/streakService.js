// Streak Service - Gamification for User Engagement
// Track weekly trip planning streaks and milestones

const User = require('../models/User');
const Trip = require('../models/Trip');
const logger = require('../config/logger');

/**
 * Calculate user's current trip planning streak
 */
async function calculateStreak(phoneNumber) {
  try {
    const { hashPhoneNumber } = require('../utils/security');
    const phoneHash = hashPhoneNumber(phoneNumber);

    // Get user's trips sorted by date
    const trips = await Trip.find({ userPhoneHash: phoneHash })
      .sort({ createdAt: -1 })
      .lean();

    if (trips.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalTrips: 0,
        lastTripDate: null,
      };
    }

    // Group trips by week
    const tripsByWeek = {};
    
    trips.forEach(trip => {
      const date = new Date(trip.createdAt);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!tripsByWeek[weekKey]) {
        tripsByWeek[weekKey] = 0;
      }
      tripsByWeek[weekKey]++;
    });

    // Calculate current streak
    let currentStreak = 0;
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    
    // Check weeks going backwards
    for (let i = 0; i < 52; i++) { // Max 1 year
      const weekDate = new Date(currentWeekStart);
      weekDate.setDate(weekDate.getDate() - (i * 7));
      const weekKey = weekDate.toISOString().split('T')[0];
      
      if (tripsByWeek[weekKey] && tripsByWeek[weekKey] > 0) {
        currentStreak++;
      } else if (i > 0) {
        // Gap found, stop counting
        break;
      }
    }

    // Calculate longest streak
    const weeks = Object.keys(tripsByWeek).sort();
    let longestStreak = 0;
    let tempStreak = 0;
    
    for (let i = 0; i < weeks.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prevWeek = new Date(weeks[i - 1]);
        const currWeek = new Date(weeks[i]);
        const diffDays = (currWeek - prevWeek) / (1000 * 60 * 60 * 24);
        
        if (diffDays === 7) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }
    
    longestStreak = Math.max(longestStreak, tempStreak);

    return {
      currentStreak,
      longestStreak,
      totalTrips: trips.length,
      lastTripDate: trips[0]?.createdAt,
    };

  } catch (error) {
    logger.error('Failed to calculate streak', {
      error: error.message,
      phoneNumber,
    });

    return {
      currentStreak: 0,
      longestStreak: 0,
      totalTrips: 0,
      lastTripDate: null,
    };
  }
}

/**
 * Get streak achievement message
 */
function getStreakMessage(streak) {
  const messages = [];

  if (streak.currentStreak === 0) {
    messages.push("🚀 Plan your first trip to start a streak!");
  } else if (streak.currentStreak === 1) {
    messages.push("🔥 You've planned trips 1 week in a row!");
  } else if (streak.currentStreak === 2) {
    messages.push("🔥🔥 You've planned trips 2 weeks in a row!");
  } else if (streak.currentStreak === 3) {
    messages.push("🔥🔥🔥 You've planned trips 3 weeks in a row! Amazing!");
  } else if (streak.currentStreak === 4) {
    messages.push("⭐ 4 weeks streak! You're a travel enthusiast!");
  } else if (streak.currentStreak >= 5 && streak.currentStreak < 10) {
    messages.push(`🏆 ${streak.currentStreak} weeks streak! You're on fire!`);
  } else if (streak.currentStreak >= 10 && streak.currentStreak < 20) {
    messages.push(`🌟 ${streak.currentStreak} weeks streak! Travel Master!`);
  } else if (streak.currentStreak >= 20) {
    messages.push(`👑 ${streak.currentStreak} weeks streak! LEGENDARY TRAVELER!`);
  }

  if (streak.longestStreak > streak.currentStreak) {
    messages.push(`Your longest streak: ${streak.longestStreak} weeks`);
  }

  messages.push(`Total trips planned: ${streak.totalTrips}`);

  return messages.join('\n');
}

/**
 * Check and award streak bonuses
 */
async function checkStreakBonuses(phoneNumber) {
  try {
    const streak = await calculateStreak(phoneNumber);
    const bonuses = [];

    // Weekly streak bonus (every 4 weeks)
    if (streak.currentStreak > 0 && streak.currentStreak % 4 === 0) {
      bonuses.push({
        type: 'streak_bonus',
        trips: 1,
        message: `🎉 ${streak.currentStreak} week streak! You earned 1 bonus trip!`,
      });

      // Apply bonus
      const { hashPhoneNumber } = require('../utils/security');
      const phoneHash = hashPhoneNumber(phoneNumber);

      await User.findOneAndUpdate(
        { phoneHash },
        { $inc: { 'subscription.tripsRemaining': 1 } }
      );
    }

    // Milestone bonuses
    if (streak.totalTrips === 10) {
      bonuses.push({
        type: 'milestone_bonus',
        trips: 2,
        message: '🎊 10 trips planned! You earned 2 bonus trips!',
      });
    } else if (streak.totalTrips === 25) {
      bonuses.push({
        type: 'milestone_bonus',
        trips: 5,
        message: '🏆 25 trips planned! You earned 5 bonus trips!',
      });
    } else if (streak.totalTrips === 50) {
      bonuses.push({
        type: 'milestone_bonus',
        trips: 10,
        message: '👑 50 trips planned! You earned 10 bonus trips!',
      });
    }

    return {
      success: true,
      streak,
      bonuses,
    };

  } catch (error) {
    logger.error('Failed to check streak bonuses', {
      error: error.message,
      phoneNumber,
    });

    return {
      success: false,
      error: 'Failed to check streak bonuses',
    };
  }
}

/**
 * Get user's gamification stats
 */
async function getGamificationStats(phoneNumber) {
  try {
    const streak = await calculateStreak(phoneNumber);
    const { getReferralStats } = require('./referralService');
    const referralStats = await getReferralStats(phoneNumber);

    const { hashPhoneNumber } = require('../utils/security');
    const phoneHash = hashPhoneNumber(phoneNumber);
    const user = await User.findOne({ phoneHash }).lean();

    const stats = {
      streak,
      referrals: referralStats.stats || {},
      totalTrips: user?.totalTrips || 0,
      memberSince: user?.joinedAt || user?.createdAt,
      level: getUserLevel(user, streak, referralStats.stats),
    };

    return {
      success: true,
      stats,
    };

  } catch (error) {
    logger.error('Failed to get gamification stats', {
      error: error.message,
      phoneNumber,
    });

    return {
      success: false,
      error: 'Failed to get gamification stats',
    };
  }
}

/**
 * Determine user level based on activity
 */
function getUserLevel(user, streak, referrals) {
  const totalTrips = user?.totalTrips || 0;
  const referralCount = referrals?.completedReferred || 0;
  const currentStreak = streak?.currentStreak || 0;

  // Calculate score
  let score = totalTrips * 10 + referralCount * 20 + currentStreak * 5;

  // Determine level
  if (score >= 500) return { name: 'Legendary Traveler', level: 5, emoji: '👑' };
  if (score >= 300) return { name: 'Travel Master', level: 4, emoji: '🌟' };
  if (score >= 150) return { name: 'Travel Enthusiast', level: 3, emoji: '⭐' };
  if (score >= 50) return { name: 'Explorer', level: 2, emoji: '🔥' };
  return { name: 'New Traveler', level: 1, emoji: '🚀' };
}

/**
 * Format gamification stats message
 */
function formatGamificationMessage(stats) {
  const { streak, referrals, totalTrips, level, memberSince } = stats;

  let message = `🎮 *YOUR TRAVEL PROFILE*\n\n`;
  message += `${level.emoji} *Level ${level.level}: ${level.name}*\n\n`;

  message += `🔥 *Streak:*\n`;
  message += `Current: ${streak.currentStreak} weeks\n`;
  message += `Longest: ${streak.longestStreak} weeks\n\n`;

  message += `👥 *Referrals:*\n`;
  message += `Friends referred: ${referrals.totalReferred || 0}\n`;
  message += `Bonus trips earned: ${referrals.bonusTripsEarned || 0}\n\n`;

  message += `📊 *Stats:*\n`;
  message += `Total trips: ${totalTrips}\n`;
  
  if (memberSince) {
    const daysSince = Math.floor((Date.now() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24));
    message += `Member for: ${daysSince} days\n`;
  }

  message += `\n💡 Keep planning trips to level up!`;

  return message;
}

module.exports = {
  calculateStreak,
  getStreakMessage,
  checkStreakBonuses,
  getGamificationStats,
  formatGamificationMessage,
  getUserLevel,
};
