// Queue Monitor
// Provides queue statistics and monitoring endpoints

const logger = require('../config/logger');
const { getQueueStats, getFailedJobs } = require('./messageQueue');

/**
 * Get comprehensive queue statistics
 */
async function getQueueMonitorStats() {
  try {
    const stats = await getQueueStats();
    const failedJobs = await getFailedJobs(0, 5); // Last 5 failed jobs

    return {
      ...stats,
      failedJobs: failedJobs.map(job => ({
        id: job.id,
        phoneNumber: job.phoneNumber,
        error: job.error?.substring(0, 200),
        attempts: job.attempts,
        timestamp: job.timestamp,
      })),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to get queue monitor stats', {
      error: error.message,
    });
    return {
      active: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      total: 0,
      failedJobs: [],
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}

/**
 * Get queue health status
 */
async function getQueueHealth() {
  try {
    const stats = await getQueueStats();

    const health = {
      status: 'healthy',
      waitingJobs: stats.waiting,
      activeJobs: stats.active,
      failedJobs: stats.failed,
    };

    // Determine health status
    if (stats.waiting > 1000) {
      health.status = 'warning';
      health.message = 'High queue backlog';
    }

    if (stats.waiting > 5000) {
      health.status = 'critical';
      health.message = 'Queue backlog critical';
    }

    if (stats.failed > 100) {
      health.status = 'warning';
      health.message = 'High failure rate';
    }

    return health;
  } catch (error) {
    logger.error('Failed to get queue health', {
      error: error.message,
    });
    return {
      status: 'error',
      message: error.message,
    };
  }
}

module.exports = {
  getQueueMonitorStats,
  getQueueHealth,
};
