// Affiliate Analytics Service
// Track and analyze affiliate link clicks

const AffiliateClick = require('../models/AffiliateClick');
const logger = require('../config/logger');

/**
 * Track affiliate link click
 */
async function trackClick(clickData) {
  try {
    const click = await AffiliateClick.trackClick(clickData);

    logger.info('Affiliate click tracked', {
      platform: clickData.platform,
      destination: clickData.destination,
      linkType: clickData.linkType,
    });

    return click;

  } catch (error) {
    logger.error('Failed to track affiliate click', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get platform performance stats
 */
async function getPlatformStats(period = 'month') {
  try {
    let startDate;
    const endDate = new Date();

    switch (period) {
      case 'week':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }

    const stats = await AffiliateClick.getPlatformStats(startDate, endDate);

    return {
      success: true,
      stats,
      period,
    };

  } catch (error) {
    logger.error('Failed to get platform stats', {
      error: error.message,
    });
    return {
      success: false,
      error: 'Failed to get platform stats',
    };
  }
}

/**
 * Get destination popularity
 */
async function getDestinationStats(limit = 10) {
  try {
    const stats = await AffiliateClick.getDestinationStats(limit);

    return {
      success: true,
      stats,
    };

  } catch (error) {
    logger.error('Failed to get destination stats', {
      error: error.message,
    });
    return {
      success: false,
      error: 'Failed to get destination stats',
    };
  }
}

/**
 * Get daily click trends
 */
async function getDailyTrends(days = 30) {
  try {
    const trends = await AffiliateClick.getDailyTrends(days);

    return {
      success: true,
      trends,
    };

  } catch (error) {
    logger.error('Failed to get daily trends', {
      error: error.message,
    });
    return {
      success: false,
      error: 'Failed to get daily trends',
    };
  }
}

/**
 * Get user's click history
 */
async function getUserClickHistory(phoneHash, limit = 20) {
  try {
    const clicks = await AffiliateClick.getUserClickHistory(phoneHash, limit);

    return {
      success: true,
      clicks,
    };

  } catch (error) {
    logger.error('Failed to get user click history', {
      error: error.message,
    });
    return {
      success: false,
      error: 'Failed to get click history',
    };
  }
}

/**
 * Generate affiliate report
 */
async function generateReport(period = 'month') {
  try {
    const platformStats = await getPlatformStats(period);
    const destinationStats = await getDestinationStats(10);
    const dailyTrends = await getDailyTrends(30);

    const report = {
      period,
      generatedAt: new Date(),
      platforms: platformStats.stats || [],
      destinations: destinationStats.stats || [],
      trends: dailyTrends.trends || [],
      summary: {
        totalPlatforms: (platformStats.stats || []).length,
        topPlatform: (platformStats.stats || [])[0]?.platform || 'N/A',
        topDestination: (destinationStats.stats || [])[0]?.destination || 'N/A',
      },
    };

    return {
      success: true,
      report,
    };

  } catch (error) {
    logger.error('Failed to generate affiliate report', {
      error: error.message,
    });
    return {
      success: false,
      error: 'Failed to generate report',
    };
  }
}

/**
 * Format affiliate stats message
 */
function formatStatsMessage(report) {
  try {
    const { platforms, destinations, summary } = report;

    let message = `📊 *AFFILIATE ANALYTICS REPORT*\n\n`;

    message += `*Top Platforms:*\n`;
    platforms.slice(0, 5).forEach((platform, index) => {
      const icons = {
        makemytrip: '✈️',
        goibibo: '🛫',
        booking: '🏨',
        irctc: '🚂',
        redbus: '🚌',
      };
      const icon = icons[platform.platform] || '🔗';
      message += `${index + 1}. ${icon} ${platform.platform}: ${platform.totalClicks} clicks\n`;
    });

    message += `\n*Top Destinations:*\n`;
    destinations.slice(0, 5).forEach((dest, index) => {
      message += `${index + 1}. 📍 ${dest.destination}: ${dest.totalClicks} clicks\n`;
    });

    message += `\n━━━━━━━━━━━━━━━━\n`;
    message += `Total platforms: ${summary.totalPlatforms}\n`;
    message += `Top platform: ${summary.topPlatform}\n`;
    message += `Top destination: ${summary.topDestination}`;

    return message;

  } catch (error) {
    logger.error('Failed to format stats message', {
      error: error.message,
    });
    return '📊 Affiliate analytics report unavailable.';
  }
}

module.exports = {
  trackClick,
  getPlatformStats,
  getDestinationStats,
  getDailyTrends,
  getUserClickHistory,
  generateReport,
  formatStatsMessage,
};
