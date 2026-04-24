// Database Configuration
// MongoDB connection using Mongoose with auto-reconnect and graceful shutdown

const mongoose = require('mongoose');
const logger = require('../config/logger');

// Configuration
const DB_CONFIG = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/travelbot',
  options: {
    // Connection pool
    maxPoolSize: 10,
    minPoolSize: 2,
    
    // Timeouts
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    
    // Auto-reconnect
    retryWrites: true,
    retryReads: true,
    
    // Heartbeat
    heartbeatFrequencyMS: 10000,
  },
};

// Connection state
let isConnected = false;
let connectionAttempts = 0;

/**
 * Connect to MongoDB
 */
async function connect() {
  try {
    connectionAttempts++;
    
    logger.info(`Attempting MongoDB connection (attempt ${connectionAttempts})`, {
      uri: maskURI(DB_CONFIG.uri),
    });

    mongoose.connection.on('connected', () => {
      logger.info('✅ MongoDB connected successfully');
      isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      logger.error('❌ MongoDB connection error', {
        error: error.message,
        attempt: connectionAttempts,
      });
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected');
      isConnected = true;
    });

    await mongoose.connect(DB_CONFIG.uri, DB_CONFIG.options);

    logger.info('🚀 MongoDB connection established');
    return mongoose.connection;

  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
async function disconnect() {
  try {
    logger.info('Shutting down MongoDB connection...');
    
    await mongoose.disconnect();
    isConnected = false;
    
    logger.info('✅ MongoDB connection closed gracefully');
  } catch (error) {
    logger.error('Error during MongoDB shutdown', {
      error: error.message,
    });
  }
}

/**
 * Check if MongoDB is connected
 */
function isMongoDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get connection status
 */
function getConnectionStatus() {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return {
    connected: isMongoDBConnected(),
    state: states[mongoose.connection.readyState] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    attempts: connectionAttempts,
  };
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    if (!isMongoDBConnected()) {
      return { success: false, error: 'Not connected' };
    }

    // Simple query to test connection
    await mongoose.connection.db.admin().ping();
    
    logger.info('✅ MongoDB connection test successful');
    return { success: true };

  } catch (error) {
    logger.error('MongoDB connection test failed', {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Mask URI for logging (hide credentials)
 */
function maskURI(uri) {
  if (!uri) return 'not configured';
  
  try {
    const url = new URL(uri);
    
    if (url.password) {
      url.password = '***';
    }
    
    return url.toString();
  } catch {
    return uri.substring(0, 20) + '...';
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  try {
    if (!isMongoDBConnected()) {
      return null;
    }

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const stats = {
      collections: [],
      totalSize: 0,
    };

    for (const collection of collections) {
      const collectionStats = await db.command({
        collStats: collection.name,
      });

      stats.collections.push({
        name: collection.name,
        count: collectionStats.count,
        size: collectionStats.size,
        avgObjSize: collectionStats.avgObjSize,
        indexes: collectionStats.nindexes,
      });

      stats.totalSize += collectionStats.size;
    }

    return stats;

  } catch (error) {
    logger.error('Failed to get database stats', {
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  connect,
  disconnect,
  isMongoDBConnected,
  getConnectionStatus,
  testConnection,
  getDatabaseStats,
  mongoose,
  DB_CONFIG,
};
