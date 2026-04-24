// Redis Configuration
// Production-ready Redis connection with auto-reconnect and error handling

const Redis = require('ioredis');
const logger = require('../config/logger');

// Configuration
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: parseInt(process.env.REDIS_DB) || 0,
  keyPrefix: 'travelbot:',
  
  // Connection retry strategy
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis retry attempt ${times}, reconnecting in ${delay}ms`);
    return delay;
  },
  
  // Reconnect on error
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3,
  
  // Connection timeout
  connectTimeout: 10000,
  commandTimeout: 5000,
  
  // Keep-alive
  keepAlive: 30000,
};

// Global Redis instance
let redisClient = null;
let isConnected = false;
let connectionAttempts = 0;

/**
 * Create Redis connection
 */
function createRedisClient() {
  try {
    connectionAttempts++;
    
    logger.info(`Attempting Redis connection (attempt ${connectionAttempts})`, {
      host: REDIS_CONFIG.host,
      port: REDIS_CONFIG.port,
      db: REDIS_CONFIG.db,
    });

    const client = new Redis(REDIS_CONFIG);

    // Event: Connected
    client.on('connect', () => {
      logger.info('✅ Redis connected successfully', {
        host: REDIS_CONFIG.host,
        port: REDIS_CONFIG.port,
      });
      isConnected = true;
    });

    // Event: Ready
    client.on('ready', () => {
      logger.info('🚀 Redis client ready');
    });

    // Event: Error
    client.on('error', (error) => {
      logger.error('❌ Redis connection error', {
        error: error.message,
        code: error.code,
        attempt: connectionAttempts,
      });
      isConnected = false;
    });

    // Event: Reconnecting
    client.on('reconnecting', () => {
      logger.warn('🔄 Redis reconnecting...');
      isConnected = false;
    });

    // Event: End
    client.on('end', () => {
      logger.warn('Redis connection closed');
      isConnected = false;
    });

    return client;
  } catch (error) {
    logger.error('Failed to create Redis client', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * Get Redis client instance (singleton)
 */
function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/**
 * Check if Redis is connected
 */
function isRedisConnected() {
  return isConnected && redisClient && redisClient.status === 'ready';
}

/**
 * Get connection status
 */
function getConnectionStatus() {
  return {
    connected: isRedisConnected(),
    status: redisClient?.status || 'not_initialized',
    host: REDIS_CONFIG.host,
    port: REDIS_CONFIG.port,
    attempts: connectionAttempts,
  };
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  try {
    logger.info('Shutting down Redis connection...');
    
    if (redisClient) {
      await redisClient.quit();
      logger.info('✅ Redis connection closed gracefully');
    }
    
    isConnected = false;
    redisClient = null;
  } catch (error) {
    logger.error('Error during Redis shutdown', {
      error: error.message,
    });
  }
}

/**
 * Test Redis connection
 */
async function testConnection() {
  try {
    const client = getRedisClient();
    
    if (!client) {
      return { success: false, error: 'Failed to create Redis client' };
    }

    const result = await client.ping();
    
    if (result === 'PONG') {
      logger.info('✅ Redis connection test successful');
      return { success: true };
    } else {
      return { success: false, error: 'Unexpected ping response' };
    }
  } catch (error) {
    logger.error('Redis connection test failed', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Execute Redis command with error handling
 * Falls back gracefully if Redis is down
 */
async function executeCommand(command, ...args) {
  try {
    if (!isRedisConnected()) {
      logger.warn('Redis not connected, command skipped', { command });
      return null;
    }

    const client = getRedisClient();
    
    if (!client) {
      return null;
    }

    return await client[command](...args);
  } catch (error) {
    logger.error(`Redis command failed: ${command}`, {
      error: error.message,
      args: args?.slice(0, 2), // Log first 2 args for debugging
    });
    return null;
  }
}

// Export
module.exports = {
  getRedisClient,
  isRedisConnected,
  getConnectionStatus,
  shutdown,
  testConnection,
  executeCommand,
  REDIS_CONFIG,
};
