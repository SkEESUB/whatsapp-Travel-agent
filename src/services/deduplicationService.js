// deduplicationService.js - Redis-based message ID caching to prevent duplicate webhook processing

const { executeCommand, isRedisConnected } = require('../config/redis');
const logger = require('../config/logger');

const CACHE_TTL = 10 * 60; // 10 minutes in seconds
const memoryCache = new Set(); // In-memory fallback

/**
 * Check if a message ID has already been processed.
 * If not, cache it.
 * @param {string} messageId - WhatsApp message ID
 * @returns {Promise<boolean>} - true if it is a duplicate, false otherwise
 */
async function checkAndCacheMessageId(messageId) {
  if (!messageId) return false;
  
  const key = `msg_cache:${messageId}`;
  
  try {
    if (isRedisConnected()) {
      // SET with NX and EX to atomically check and set with TTL
      const result = await executeCommand('set', key, '1', 'EX', CACHE_TTL, 'NX');
      // If result is 'OK', it was NOT in the cache (not a duplicate)
      // If result is null, it WAS in the cache (is a duplicate)
      return result === null;
    }
    
    // Fallback to in-memory cache
    if (memoryCache.has(messageId)) {
      return true;
    }
    
    memoryCache.add(messageId);
    // Auto cleanup after 10 minutes for memory cache
    setTimeout(() => {
      memoryCache.delete(messageId);
    }, CACHE_TTL * 1000);
    
    return false;
  } catch (error) {
    logger.error('Failed to deduplicate message ID', { messageId, error: error.message });
    return false; // Process it in case of errors to be safe
  }
}

module.exports = {
  checkAndCacheMessageId,
};
