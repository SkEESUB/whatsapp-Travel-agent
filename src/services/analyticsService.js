// Analytics Service
// Track user activity, trips, and generate reports

const Analytics = require('../models/Analytics');
const Trip = require('../models/Trip');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Track a message event
 */
async function trackMessage(phoneNumber) {
  try {
    const today = await Analytics.getToday();
    await today.incrementMessages();
  } catch (error) {
    // Don't throw - analytics shouldn't break main flow
    logger.error('Failed to track message', {
      error: error.message,
    });
  }
}

/**
 * Track a trip creation
 */
async function trackTrip(destination, services = []) {
  try {
    const today = await Analytics.getToday();
    
    // Track trip
    await today.incrementTrips();
    
    // Track destination
    await today.addDestination(destination);
    
    // Track services used
    for (const service of services) {
      await today.addServiceUsage(service);
    }
  } catch (error) {
    logger.error('Failed to track trip', {
      error: error.message,
    });
  }
}

/**
 * Track an error
 */
async function trackError() {
  try {
    const today = await Analytics.getToday();
    await today.recordError();
  } catch (error) {
    logger.error('Failed to track error', {
      error: error.message,
    });
  }
}

/**
 * Track response time
 */
async function trackResponseTime(responseTime) {
  try {
    const today = await Analytics.getToday();
    await today.updateResponseTime(responseTime);
  } catch (error) {
    logger.error('Failed to track response time', {
      error: error.message,
    });
  }
}

/**
 * Get daily statistics
 */
async function getDailyStats(date) {
  try {
    const targetDate = date || new Date();
    
    const analytics = await Analytics.getByDate(targetDate);
    
    if (!analytics) {
      return {
        date: targetDate,
        totalMessages: 0,
        totalUsers: 0,
        newUsers: 0,
        totalTrips: 0,
        completedTrips: 0,
        popularDestinations: [],
        popularServices: [],
        avgResponseTime: 0,
        errorCount: 0,
        revenue: 0,
      };
    }
    
    return analytics;
  } catch (error) {
    logger.error('Failed to get daily stats', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get statistics for last N days
 */
async function getLastNDaysStats(days = 7) {
  try {
    const summary = await Analytics.getSummary(days);
    
    return {
      period: `${days} days`,
      ...summary,
    };
  } catch (error) {
    logger.error('Failed to get last N days stats', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get popular destinations
 */
async function getPopularDestinations(days = 30, limit = 10) {
  try {
    const destinations = await Trip.getPopularDestinations(days, limit);
    
    return destinations;
  } catch (error) {
    logger.error('Failed to get popular destinations', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Get popular services
 */
async function getPopularServices(days = 30) {
  try {
    const services = await Trip.getPopularServices(days);
    
    return services;
  } catch (error) {
    logger.error('Failed to get popular services', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Get revenue for date range
 */
async function getRevenue(startDate, endDate) {
  try {
    const analytics = await Analytics.getByDateRange(startDate, endDate);
    
    const totalRevenue = analytics.reduce((sum, day) => {
      return sum + (day.revenue || 0);
    }, 0);
    
    return {
      startDate,
      endDate,
      totalRevenue,
      days: analytics.length,
      avgDailyRevenue: analytics.length > 0 ? totalRevenue / analytics.length : 0,
    };
  } catch (error) {
    logger.error('Failed to get revenue', {
      error: error.message,
    });
    return {
      totalRevenue: 0,
      days: 0,
      avgDailyRevenue: 0,
    };
  }
}

/**
 * Get comprehensive dashboard data
 */
async function getDashboardData() {
  try {
    // Last 7 days summary
    const last7Days = await Analytics.getSummary(7);
    
    // Today's stats
    const today = await Analytics.getToday();
    
    // Popular destinations (last 30 days)
    const popularDestinations = await Trip.getPopularDestinations(30, 10);
    
    // Popular services (last 30 days)
    const popularServices = await Trip.getPopularServices(30);
    
    // Trip statistics
    const tripStats = await Trip.getTripStats(30);
    
    // User statistics
    const activeUsers = await User.getActiveUsersCount(1);
    const totalUsers = await User.countDocuments().lean();
    const usersByPlan = await User.getUsersByPlan();
    
    // Recent trips
    const recentTrips = await Trip.getRecentTrips(10);
    
    return {
      today: {
        date: today.date,
        messages: today.totalMessages,
        trips: today.totalTrips,
        errors: today.errorCount,
      },
      last7Days,
      popularDestinations,
      popularServices,
      tripStats,
      users: {
        total: totalUsers,
        active: activeUsers,
        byPlan: usersByPlan,
      },
      recentTrips,
    };
  } catch (error) {
    logger.error('Failed to get dashboard data', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get user growth statistics
 */
async function getUserGrowth(days = 30) {
  try {
    const analytics = await Analytics.getByDateRange(
      new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      new Date()
    );
    
    const growth = analytics.map(day => ({
      date: day.date,
      newUsers: day.newUsers,
      totalUsers: day.totalUsers,
    }));
    
    return growth;
  } catch (error) {
    logger.error('Failed to get user growth', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Update new users count for today
 */
async function updateNewUsersCount(count) {
  try {
    const today = await Analytics.getToday();
    
    await Analytics.findByIdAndUpdate(
      today._id,
      { $set: { newUsers: count } }
    );
  } catch (error) {
    logger.error('Failed to update new users count', {
      error: error.message,
    });
  }
}

/**
 * Update total users count for today
 */
async function updateTotalUsersCount(count) {
  try {
    const today = await Analytics.getToday();
    
    await Analytics.findByIdAndUpdate(
      today._id,
      { $set: { totalUsers: count } }
    );
  } catch (error) {
    logger.error('Failed to update total users count', {
      error: error.message,
    });
  }
}

/**
 * Add revenue for today
 */
async function addRevenue(amount) {
  try {
    const today = await Analytics.getToday();
    
    await Analytics.findByIdAndUpdate(
      today._id,
      { $inc: { revenue: amount } }
    );
  } catch (error) {
    logger.error('Failed to add revenue', {
      error: error.message,
    });
  }
}

module.exports = {
  trackMessage,
  trackTrip,
  trackError,
  trackResponseTime,
  getDailyStats,
  getLastNDaysStats,
  getPopularDestinations,
  getPopularServices,
  getRevenue,
  getDashboardData,
  getUserGrowth,
  updateNewUsersCount,
  updateTotalUsersCount,
  addRevenue,
};
