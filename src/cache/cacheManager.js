// Cache Manager
// Redis-based caching with smart key generation and TTL strategy

const logger = require('../config/logger');
const { getRedisClient, isRedisConnected, executeCommand } = require('../config/redis');

// TTL Configuration (in seconds)
const TTL_CONFIG = {
  HOTELS: 6 * 60 * 60,        // 6 hours
  ITINERARY: 12 * 60 * 60,    // 12 hours
  TRANSPORT: 1 * 60 * 60,     // 1 hour (prices change frequently)
  FOOD: 24 * 60 * 60,         // 24 hours
  WEATHER: 3 * 60 * 60,       // 3 hours
  BUDGET: 6 * 60 * 60,        // 6 hours
  DEFAULT: 1 * 60 * 60,       // 1 hour default
};

// Cache statistics
let cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
};

/**
 * Generate cache key for hotels
 */
function generateHotelKey(destination, budget, people) {
  const budgetRange = normalizeBudgetRange(budget);
  const peopleCount = Math.min(people || 1, 10); // Cap at 10
  return `hotels:${destination.toLowerCase()}:${budgetRange}:${peopleCount}`;
}

/**
 * Generate cache key for itinerary
 */
function generateItineraryKey(destination, days, travelStyle) {
  const style = (travelStyle || 'general').toLowerCase();
  return `itinerary:${destination.toLowerCase()}:${days}:${style}`;
}

/**
 * Generate cache key for transport
 */
function generateTransportKey(source, destination, date) {
  const dateStr = date || 'any';
  return `transport:${source.toLowerCase()}:${destination.toLowerCase()}:${dateStr}`;
}

/**
 * Generate cache key for food guide
 */
function generateFoodKey(destination) {
  return `food:${destination.toLowerCase()}`;
}

/**
 * Generate cache key for weather
 */
function generateWeatherKey(destination, date) {
  const dateStr = date || new Date().toISOString().split('T')[0];
  return `weather:${destination.toLowerCase()}:${dateStr}`;
}

/**
 * Generate cache key for budget breakdown
 */
function generateBudgetKey(destination, days, people, budget) {
  const budgetRange = normalizeBudgetRange(budget);
  const peopleCount = Math.min(people || 1, 10);
  return `budget:${destination.toLowerCase()}:${days}:${peopleCount}:${budgetRange}`;
}

/**
 * Normalize budget to ranges for better cache hit rate
 */
function normalizeBudgetRange(budget) {
  if (!budget || budget <= 0) return 'unknown';
  
  if (budget <= 5000) return 'budget';
  if (budget <= 15000) return 'mid';
  if (budget <= 30000) return 'premium';
  return 'luxury';
}

/**
 * Get data from cache
 */
async function getFromCache(key) {
  try {
    if (!isRedisConnected()) {
      logger.debug('Redis not connected, cache skip', { key });
      return null;
    }

    const cachedData = await executeCommand('get', key);

    if (cachedData) {
      cacheStats.hits++;
      logger.debug('✅ Cache hit', { key });
      return JSON.parse(cachedData);
    }

    cacheStats.misses++;
    logger.debug('❌ Cache miss', { key });
    return null;

  } catch (error) {
    cacheStats.errors++;
    logger.error('Cache get error', {
      key,
      error: error.message,
    });
    return null;
  }
}

/**
 * Set data in cache with TTL
 */
async function setCache(key, data, ttlSeconds = TTL_CONFIG.DEFAULT) {
  try {
    if (!isRedisConnected()) {
      logger.debug('Redis not connected, cache skip', { key });
      return false;
    }

    const serializedData = JSON.stringify(data);
    await executeCommand('setex', key, ttlSeconds, serializedData);

    cacheStats.sets++;
    logger.debug('💾 Cache set', {
      key,
      ttl: ttlSeconds,
      dataSize: serializedData.length,
    });

    return true;

  } catch (error) {
    cacheStats.errors++;
    logger.error('Cache set error', {
      key,
      error: error.message,
    });
    return false;
  }
}

/**
 * Invalidate cache by pattern
 */
async function invalidateCache(pattern) {
  try {
    if (!isRedisConnected()) {
      logger.warn('Redis not connected, cache invalidation skipped', { pattern });
      return 0;
    }

    const client = getRedisClient();
    if (!client) return 0;

    // Find all keys matching pattern
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      logger.debug('No keys to invalidate', { pattern });
      return 0;
    }

    // Delete all matching keys
    await Promise.all(keys.map(key => executeCommand('del', key)));

    logger.info('🗑️ Cache invalidated', {
      pattern,
      keysDeleted: keys.length,
    });

    return keys.length;

  } catch (error) {
    cacheStats.errors++;
    logger.error('Cache invalidation error', {
      pattern,
      error: error.message,
    });
    return 0;
  }
}

/**
 * Cache-through pattern wrapper
 * Checks cache first, calls function on miss, stores result
 */
async function cachedCall(key, ttl, fetchFunction) {
  try {
    // Step 1: Check cache
    const cached = await getFromCache(key);
    
    if (cached !== null) {
      return {
        data: cached,
        fromCache: true,
        cacheKey: key,
      };
    }

    // Step 2: Cache miss - call fetch function
    logger.info('🔄 Cache miss, calling API', { key });
    const result = await fetchFunction();

    // Step 3: Store in cache
    if (result && result.success !== false) {
      await setCache(key, result, ttl);
    }

    return {
      data: result,
      fromCache: false,
      cacheKey: key,
    };

  } catch (error) {
    logger.error('cachedCall error', {
      key,
      error: error.message,
    });

    // On error, try to call function directly
    try {
      const result = await fetchFunction();
      return {
        data: result,
        fromCache: false,
        cacheKey: key,
        error: true,
      };
    } catch (fetchError) {
      throw fetchError;
    }
  }
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
  try {
    const total = cacheStats.hits + cacheStats.misses;
    const hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(2) : 0;
    const missRate = total > 0 ? ((cacheStats.misses / total) * 100).toFixed(2) : 0;

    let totalKeys = 0;
    if (isRedisConnected()) {
      const client = getRedisClient();
      if (client) {
        const keys = await client.keys('hotels:*');
        const itineraryKeys = await client.keys('itinerary:*');
        const transportKeys = await client.keys('transport:*');
        const foodKeys = await client.keys('food:*');
        const weatherKeys = await client.keys('weather:*');
        const budgetKeys = await client.keys('budget:*');
        
        totalKeys = keys.length + itineraryKeys.length + transportKeys.length + 
                    foodKeys.length + weatherKeys.length + budgetKeys.length;
      }
    }

    return {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      errors: cacheStats.errors,
      sets: cacheStats.sets,
      hitRate: `${hitRate}%`,
      missRate: `${missRate}%`,
      totalKeys,
      totalRequests: total,
      ttlConfig: {
        hotels: `${TTL_CONFIG.HOTELS / 3600} hours`,
        itinerary: `${TTL_CONFIG.ITINERARY / 3600} hours`,
        transport: `${TTL_CONFIG.TRANSPORT / 3600} hour`,
        food: `${TTL_CONFIG.FOOD / 3600} hours`,
        weather: `${TTL_CONFIG.WEATHER / 3600} hours`,
        budget: `${TTL_CONFIG.BUDGET / 3600} hours`,
      },
    };

  } catch (error) {
    logger.error('Failed to get cache stats', {
      error: error.message,
    });
    return {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      errors: cacheStats.errors,
      sets: cacheStats.sets,
      hitRate: '0%',
      missRate: '0%',
      totalKeys: 0,
      totalRequests: cacheStats.hits + cacheStats.misses,
    };
  }
}

/**
 * Reset cache statistics
 */
function resetCacheStats() {
  cacheStats = {
    hits: 0,
    misses: 0,
    errors: 0,
    sets: 0,
  };
  logger.info('Cache stats reset');
}

/**
 * Invalidate all cache
 */
async function invalidateAllCache() {
  try {
    const patterns = [
      'hotels:*',
      'itinerary:*',
      'transport:*',
      'food:*',
      'weather:*',
      'budget:*',
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await invalidateCache(pattern);
    }

    logger.info('🗑️ All cache invalidated', { totalDeleted });
    return totalDeleted;

  } catch (error) {
    logger.error('Failed to invalidate all cache', {
      error: error.message,
    });
    return 0;
  }
}

/**
 * Get cache size (approximate)
 */
async function getCacheSize() {
  try {
    if (!isRedisConnected()) {
      return 0;
    }

    const client = getRedisClient();
    if (!client) return 0;

    const keys = await client.keys('travelbot:*');
    let totalSize = 0;

    for (const key of keys) {
      const size = await executeCommand('strlen', key);
      totalSize += size || 0;
    }

    return totalSize;

  } catch (error) {
    logger.error('Failed to get cache size', {
      error: error.message,
    });
    return 0;
  }
}

// Export
// Duplicate getCacheStats removed to fix syntax error (already defined on line 248)

module.exports = {
  // Key generators
  generateHotelKey,
  generateItineraryKey,
  generateTransportKey,
  generateFoodKey,
  generateWeatherKey,
  generateBudgetKey,
  
  // Cache operations
  getFromCache,
  setCache,
  invalidateCache,
  cachedCall,
  
  // Stats and monitoring
  getCacheStats,
  resetCacheStats,
  invalidateAllCache,
  getCacheSize,
  
  // Utilities
  normalizeBudgetRange,
  
  // Constants
  TTL_CONFIG,
};

