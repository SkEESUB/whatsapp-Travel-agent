// Daily Analytics Aggregation Job
// Runs at midnight to compile daily statistics

const mongoose = require('mongoose');
const logger = require('../config/logger');
const Analytics = require('../models/Analytics');
const User = require('../models/User');
const Trip = require('../models/Trip');
const AffiliateClick = require('../models/AffiliateClick');

/**
 * Compile daily statistics and store in Analytics collection
 * Should be called daily at midnight (00:00)
 */
async function compileDailyStats(targetDate = null) {
  try {
    // Use yesterday's date by default
    const date = targetDate || new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    logger.info('Starting daily analytics aggregation', {
      date: date.toISOString(),
    });

    // Get or create analytics document for this date
    let dailyStats = await Analytics.findOne({ date });
    
    if (!dailyStats) {
      dailyStats = new Analytics({ date });
    }

    // 1. Messages received today
    // (This should be tracked incrementally, but we can estimate)
    // In production, you'd track this via middleware or message queue

    // 2. New users today
    const newUsers = await User.countDocuments({
      createdAt: { $gte: date, $lt: nextDate },
    });

    dailyStats.newUsers = newUsers;

    // 3. Total trips started today
    const tripsStarted = await Trip.countDocuments({
      createdAt: { $gte: date, $lt: nextDate },
    });

    dailyStats.tripsStarted = tripsStarted;

    // 4. Trips completed today (status = 'completed')
    const tripsCompleted = await Trip.countDocuments({
      createdAt: { $gte: date, $lt: nextDate },
      status: 'completed',
    });

    dailyStats.tripsCompleted = tripsCompleted;

    // 5. Popular destinations today
    const popularDestinations = await Trip.aggregate([
      {
        $match: {
          createdAt: { $gte: date, $lt: nextDate },
          destination: { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$destination',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    dailyStats.popularDestinations = popularDestinations.map(d => ({
      destination: d._id,
      count: d.count,
    }));

    // 6. Subscription metrics
    const newSubscriptions = await User.countDocuments({
      'subscription.plan': { $in: ['basic', 'premium'] },
      'subscription.paymentId': { $exists: true },
      updatedAt: { $gte: date, $lt: nextDate },
    });

    dailyStats.newSubscriptions = newSubscriptions;

    // 7. Calculate subscription revenue
    const subscriptionRevenue = await User.aggregate([
      {
        $match: {
          'subscription.plan': { $in: ['basic', 'premium'] },
          'subscription.paymentId': { $exists: true },
          updatedAt: { $gte: date, $lt: nextDate },
        },
      },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 },
        },
      },
    ]);

    let totalRevenue = 0;
    for (const sub of subscriptionRevenue) {
      if (sub._id === 'basic') {
        totalRevenue += sub.count * 99; // ₹99 per basic
      } else if (sub._id === 'premium') {
        totalRevenue += sub.count * 249; // ₹249 per premium
      }
    }

    dailyStats.subscriptionRevenue = totalRevenue;

    // 8. Affiliate clicks today
    const affiliateClicks = await AffiliateClick.countDocuments({
      clickedAt: { $gte: date, $lt: nextDate },
    });

    dailyStats.affiliateClicks = affiliateClicks;

    // 9. Affiliate clicks by platform
    const affiliateByPlatform = await AffiliateClick.aggregate([
      {
        $match: {
          clickedAt: { $gte: date, $lt: nextDate },
        },
      },
      {
        $group: {
          _id: '$platform',
          clicks: { $sum: 1 },
        },
      },
    ]);

    dailyStats.affiliateClicksByPlatform = affiliateByPlatform.map(p => ({
      platform: p._id,
      clicks: p.clicks,
    }));

    // 10. User engagement (active users)
    const activeUsers = await User.countDocuments({
      lastActiveAt: { $gte: date, $lt: nextDate },
    });

    dailyStats.activeUsers = activeUsers;

    // 11. Calculate conversion funnel
    dailyStats.calculateFunnel();

    // 12. Calculate conversion rate
    if (dailyStats.tripsStarted > 0) {
      dailyStats.conversionRate = Math.round(
        (dailyStats.tripsCompleted / dailyStats.tripsStarted) * 100
      );
    } else {
      dailyStats.conversionRate = 0;
    }

    // Save analytics
    await dailyStats.save();

    logger.info('Daily analytics aggregation complete', {
      date: date.toISOString(),
      newUsers,
      tripsStarted,
      tripsCompleted,
      activeUsers,
      revenue: totalRevenue,
      affiliateClicks,
    });

    return {
      success: true,
      date,
      stats: dailyStats.toObject(),
    };

  } catch (error) {
    logger.error('Daily analytics aggregation failed', {
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Schedule daily job at midnight
 * Uses setTimeout to schedule next run
 */
function scheduleDailyJob() {
  function scheduleNext() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    logger.info('Daily analytics job scheduled', {
      nextRun: tomorrow.toISOString(),
      msUntilNext: msUntilMidnight,
    });

    setTimeout(async () => {
      logger.info('Running scheduled daily analytics job');
      await compileDailyStats();
      
      // Schedule next run
      scheduleNext();
    }, msUntilMidnight);
  }

  // Schedule first run
  scheduleNext();
}

/**
 * Manual trigger for testing
 */
async function triggerManualCompilation(date) {
  logger.info('Manual daily analytics compilation triggered', {
    date: date || 'yesterday',
  });

  return await compileDailyStats(date ? new Date(date) : null);
}

module.exports = {
  compileDailyStats,
  scheduleDailyJob,
  triggerManualCompilation,
};
