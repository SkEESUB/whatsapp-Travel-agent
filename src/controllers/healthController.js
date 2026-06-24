/**
 * Health Controller
 * Handles health check and system status requests
 */

/**
 * GET /health
 * Returns basic health status
 */
const getHealth = (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

/**
 * GET /health/detailed
 * Returns detailed system status
 */
const getDetailedHealth = (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(process.uptime()),
      formatted: formatUptime(process.uptime())
    },
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
    },
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development'
    }
  });
};

/**
 * Format uptime into human-readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
}

const { isRedisConnected, getConnectionStatus } = require('../config/redis');
const mongoose = require('mongoose');

/**
 * GET /health/redis
 * Returns Redis health status
 */
const getRedisHealth = (req, res) => {
  const isConnected = isRedisConnected();
  const status = getConnectionStatus();
  
  if (isConnected) {
    res.status(200).json({
      status: 'healthy',
      service: 'redis',
      details: status
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      service: 'redis',
      details: status
    });
  }
};

/**
 * GET /health/mongo
 * Returns MongoDB health status
 */
const getMongoHealth = (req, res) => {
  const readyState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  
  const state = states[readyState] || 'unknown';
  
  if (readyState === 1) {
    res.status(200).json({
      status: 'healthy',
      service: 'mongodb',
      readyState: state
    });
  } else {
    res.status(503).json({
      status: 'unhealthy',
      service: 'mongodb',
      readyState: state
    });
  }
};

module.exports = {
  getHealth,
  getDetailedHealth,
  getRedisHealth,
  getMongoHealth
};
