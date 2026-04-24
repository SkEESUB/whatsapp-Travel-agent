// Admin Controller
// Handler functions for admin dashboard endpoints

const mongoose = require('mongoose');
const logger = require('../config/logger');
const cacheManager = require('../cache/cacheManager');
const User = require('../models/User');
const Trip = require('../models/Trip');
const Analytics = require('../models/Analytics');
const AffiliateClick = require('../models/AffiliateClick');
const { maskPhoneNumbers } = require('../middleware/adminAuth');

// Cache TTL for expensive queries (5 minutes)
const ANALYTICS_CACHE_TTL = 300;

/**
 * GET /admin/stats
 * Dashboard statistics
 */
async function getStats(req, res) {
  try {
    // Check cache
    const cacheKey = 'admin:stats:dashboard';
    const cached = await cacheManager.getFromCache(cacheKey);
    
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Parallel queries for performance
    const [
      totalUsers,
      activeToday,
      newToday,
      messagesToday,
      tripsToday,
      tripsThisMonth,
      errorsToday,
      revenueThisMonth,
    ] = await Promise.all([
      // Total users
      User.countDocuments(),
      
      // Active today (users who sent messages)
      Analytics.countDocuments({
        date: { $gte: today },
      }),
      
      // New users today
      User.countDocuments({
        createdAt: { $gte: today },
      }),
      
      // Messages today (approximate from analytics)
      (await Analytics.aggregate([
        { $match: { date: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$messagesReceived' } } },
      ]))[0]?.total || 0,
      
      // Trips planned today
      Trip.countDocuments({
        createdAt: { $gte: today },
      }),
      
      // Trips this month
      Trip.countDocuments({
        createdAt: { $gte: thisMonth },
      }),
      
      // Errors today (from analytics)
      (await Analytics.aggregate([
        { $match: { date: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$errors' } } },
      ]))[0]?.total || 0,
      
      // Revenue this month (subscriptions)
      (await Analytics.aggregate([
        { $match: { date: { $gte: thisMonth } } },
        { $group: { _id: null, total: { $sum: '$subscriptionRevenue' } } },
      ]))[0]?.total || 0,
    ]);

    const stats = {
      users: {
        total: totalUsers,
        activeToday: activeToday,
        newToday: newToday,
      },
      messages: {
        today: messagesToday,
      },
      trips: {
        today: tripsToday,
        thisMonth: tripsThisMonth,
      },
      revenue: {
        thisMonth: revenueThisMonth,
      },
      errors: {
        today: errorsToday,
      },
      timestamp: new Date().toISOString(),
    };

    // Cache for 5 minutes
    await cacheManager.setCache(cacheKey, stats, ANALYTICS_CACHE_TTL);

    res.json({ success: true, data: stats });

  } catch (error) {
    logger.error('Admin stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    });
  }
}

/**
 * GET /admin/popular-destinations?days=7
 * Top destinations by time period
 */
async function getPopularDestinations(req, res) {
  try {
    const { days = 7 } = req.query;
    const cacheKey = `admin:destinations:${days}`;
    
    const cached = await cacheManager.getFromCache(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const destinations = await Trip.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          destination: { $exists: true, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$destination',
          count: { $sum: 1 },
          avgBudget: { $avg: '$budget' },
          avgDays: { $avg: '$days' },
          avgPeople: { $avg: '$people' },
        },
      },
      {
        $project: {
          destination: '$_id',
          count: 1,
          avgBudget: { $round: ['$avgBudget', 0] },
          avgDays: { $round: ['$avgDays', 0] },
          avgPeople: { $round: ['$avgPeople', 1] },
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const result = {
      days: parseInt(days),
      destinations,
      timestamp: new Date().toISOString(),
    };

    await cacheManager.setCache(cacheKey, result, ANALYTICS_CACHE_TTL);

    res.json({ success: true, data: result });

  } catch (error) {
    logger.error('Popular destinations error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch destinations',
    });
  }
}

/**
 * GET /admin/users?page=1&limit=20
 * Paginated user list
 */
async function getUsers(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find()
        .select('phoneHash subscription totalTrips lastActiveAt createdAt')
        .sort({ lastActiveAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);

    // Mask phone numbers for privacy
    const maskedUsers = users.map(user => ({
      ...user,
      phone: maskPhoneNumber(user.phoneHash),
      phoneHash: undefined,
      subscription: user.subscription || { plan: 'free', tripsRemaining: 0 },
      totalTrips: user.totalTrips || 0,
    }));

    res.json({
      success: true,
      data: {
        users: maskedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    logger.error('Admin users error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
}

/**
 * GET /admin/trips?page=1&limit=20
 * Recent trips
 */
async function getTrips(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [trips, total] = await Promise.all([
      Trip.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Trip.countDocuments(),
    ]);

    // Mask user phone numbers
    const maskedTrips = trips.map(trip => ({
      ...trip,
      userPhone: maskPhoneNumber(trip.userPhoneHash),
      userPhoneHash: undefined,
    }));

    res.json({
      success: true,
      data: {
        trips: maskedTrips,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    logger.error('Admin trips error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trips',
    });
  }
}

/**
 * GET /admin/revenue?from=date&to=date
 * Revenue breakdown
 */
async function getRevenue(req, res) {
  try {
    const { from, to } = req.query;
    
    const startDate = from ? new Date(from) : new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const endDate = to ? new Date(to) : new Date();

    const cacheKey = `admin:revenue:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await cacheManager.getFromCache(cacheKey);
    
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const [subscriptionRevenue, affiliateStats] = await Promise.all([
      // Subscription revenue
      Analytics.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate },
            subscriptionRevenue: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            },
            revenue: { $sum: '$subscriptionRevenue' },
            newSubscriptions: { $sum: '$newSubscriptions' },
          },
        },
        {
          $project: {
            date: '$_id.date',
            revenue: 1,
            newSubscriptions: 1,
            _id: 0,
          },
        },
        { $sort: { date: 1 } },
      ]),

      // Affiliate revenue (estimated from clicks)
      AffiliateClick.aggregate([
        {
          $match: {
            clickedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } },
              platform: '$platform',
            },
            clicks: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            platforms: {
              $push: {
                platform: '$_id.platform',
                clicks: '$clicks',
              },
            },
            totalClicks: { $sum: '$clicks' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const totalSubscription = subscriptionRevenue.reduce((sum, day) => sum + day.revenue, 0);
    const totalAffiliateClicks = affiliateStats.reduce((sum, day) => sum + day.totalClicks, 0);
    
    // Estimate affiliate revenue (₹50 per booking, 10% conversion from clicks)
    const estimatedAffiliateRevenue = Math.round(totalAffiliateClicks * 0.1 * 50);

    const result = {
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      subscriptionRevenue: {
        daily: subscriptionRevenue,
        total: totalSubscription,
      },
      affiliateRevenue: {
        daily: affiliateStats,
        totalClicks: totalAffiliateClicks,
        estimated: estimatedAffiliateRevenue,
        note: 'Estimated: ₹50 per booking, 10% conversion rate',
      },
      totalRevenue: totalSubscription + estimatedAffiliateRevenue,
      timestamp: new Date().toISOString(),
    };

    await cacheManager.setCache(cacheKey, result, ANALYTICS_CACHE_TTL);

    res.json({ success: true, data: result });

  } catch (error) {
    logger.error('Revenue analytics error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue data',
    });
  }
}

/**
 * GET /admin/queue-stats
 * BullMQ queue statistics
 */
async function getQueueStats(req, res) {
  try {
    const { getQueue } = require('../queue/messageQueue');
    const queue = getQueue();

    if (!queue) {
      return res.json({
        success: true,
        data: {
          message: 'Queue not initialized',
          jobs: { active: 0, waiting: 0, completed: 0, failed: 0 },
        },
      });
    }

    const [active, waiting, completed, failed, delayed] = await Promise.all([
      queue.getActiveCount(),
      queue.getWaitingCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    res.json({
      success: true,
      data: {
        jobs: {
          active,
          waiting,
          completed,
          failed,
          delayed,
          total: active + waiting + completed + failed + delayed,
        },
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('Queue stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue stats',
    });
  }
}

/**
 * GET /admin/cache-stats
 * Redis cache statistics
 */
async function getCacheStats(req, res) {
  try {
    const stats = await cacheManager.getCacheStats();

    res.json({
      success: true,
      data: {
        cache: stats,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    logger.error('Cache stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache stats',
    });
  }
}

/**
 * GET /admin/health
 * System health check
 */
async function getHealth(req, res) {
  try {
    const health = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      },
      redis: { status: 'unknown' },
      mongodb: { status: 'unknown' },
      gemini: { status: 'unknown' },
      whatsapp: { status: 'unknown' },
    };

    // Check Redis
    try {
      const redis = require('../config/redis');
      const redisStatus = redis.getStatus();
      health.redis = redisStatus;
    } catch (error) {
      health.redis = { status: 'error', message: error.message };
    }

    // Check MongoDB
    try {
      const database = require('../config/database');
      const dbStatus = database.getStatus();
      health.mongodb = dbStatus;
    } catch (error) {
      health.mongodb = { status: 'error', message: error.message };
    }

    // Check Gemini API
    try {
      health.gemini = {
        status: process.env.GEMINI_API_KEY ? 'configured' : 'not configured',
        model: process.env.GEMINI_MODEL || 'not set',
      };
    } catch (error) {
      health.gemini = { status: 'error', message: error.message };
    }

    // Check WhatsApp API
    try {
      health.whatsapp = {
        status: process.env.WHATSAPP_ACCESS_TOKEN ? 'configured' : 'not configured',
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? 'set' : 'not set',
      };
    } catch (error) {
      health.whatsapp = { status: 'error', message: error.message };
    }

    // Overall health
    const allHealthy = 
      health.redis.status === 'connected' &&
      health.mongodb.status === 'connected';

    health.overall = allHealthy ? 'healthy' : 'degraded';

    res.json({ success: true, data: health });

  } catch (error) {
    logger.error('Health check error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Health check failed',
    });
  }
}

/**
 * POST /admin/broadcast
 * Send message to users
 */
async function broadcastMessage(req, res) {
  try {
    const { message, filter, limit = 100 } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    // Build query based on filter
    const query = {};
    
    if (filter?.plan) {
      query['subscription.plan'] = filter.plan;
    }
    
    if (filter?.activeDays) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - filter.activeDays);
      query.lastActiveAt = { $gte: daysAgo };
    }

    // Get users
    const users = await User.find(query)
      .select('phoneHash')
      .limit(limit)
      .lean();

    // Queue broadcast messages
    const { addMessageToQueue } = require('../queue/messageQueue');
    const queued = [];

    for (const user of users) {
      try {
        const job = await addMessageToQueue(user.phoneHash, message, {
          broadcast: true,
          broadcastId: Date.now(),
        });
        queued.push(job.id);
      } catch (error) {
        logger.error('Failed to queue broadcast message', {
          error: error.message,
          user: user.phoneHash,
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalUsers: users.length,
        queued: queued.length,
        failed: users.length - queued.length,
        note: 'Messages will be sent respecting WhatsApp rate limits',
      },
    });

  } catch (error) {
    logger.error('Broadcast error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast message',
    });
  }
}

/**
 * POST /admin/block-user
 * Block abusive user
 */
async function blockUser(req, res) {
  try {
    const { phoneNumber, reason } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    // Update user in database
    const { hashPhoneNumber } = require('../utils/security');
    const phoneHash = hashPhoneNumber(phoneNumber);

    const updatedUser = await User.findOneAndUpdate(
      { phoneHash },
      {
        $set: {
          isBlocked: true,
          blockedAt: new Date(),
          blockedReason: reason || 'Admin action',
        },
      },
      { new: true, lean: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    logger.warn('User blocked', {
      phoneHash,
      reason,
    });

    res.json({
      success: true,
      data: {
        message: 'User blocked successfully',
        user: maskPhoneNumbers([updatedUser])[0],
      },
    });

  } catch (error) {
    logger.error('Block user error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to block user',
    });
  }
}

module.exports = {
  getStats,
  getPopularDestinations,
  getUsers,
  getTrips,
  getRevenue,
  getQueueStats,
  getCacheStats,
  getHealth,
  broadcastMessage,
  blockUser,
};
