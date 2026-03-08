/**
 * Rate Limiter Middleware
 * Simple in-memory rate limiting for API endpoints
 */

// Store request counts: { [identifier]: { count, resetTime } }
const requestStore = new Map();

// Default configuration
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30; // 30 requests per minute

/**
 * Creates a rate limiter middleware
 * @param {Object} options - Rate limiter options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Maximum requests per window
 * @param {string} options.keyPrefix - Prefix for the key (e.g., 'webhook', 'api')
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
  const keyPrefix = options.keyPrefix || 'default';

  return function rateLimiter(req, res, next) {
    // Get identifier (user ID for WhatsApp, IP for others)
    const identifier = getIdentifier(req, keyPrefix);
    const now = Date.now();

    // Get or create entry
    let entry = requestStore.get(identifier);
    
    if (!entry || now > entry.resetTime) {
      // New window
      entry = {
        count: 1,
        resetTime: now + windowMs
      };
      requestStore.set(identifier, entry);
      
      // Set headers
      setRateLimitHeaders(res, entry, maxRequests, windowMs);
      return next();
    }

    // Increment count
    entry.count++;

    // Check limit
    if (entry.count > maxRequests) {
      setRateLimitHeaders(res, entry, maxRequests, windowMs);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        }
      });
    }

    // Set headers and continue
    setRateLimitHeaders(res, entry, maxRequests, windowMs);
    next();
  };
}

/**
 * Gets identifier for rate limiting
 * @param {Object} req - Express request
 * @param {string} prefix - Key prefix
 * @returns {string} Identifier
 */
function getIdentifier(req, prefix) {
  // For WhatsApp webhooks, use user ID if available
  if (req.body && req.body.entry) {
    try {
      const changes = req.body.entry[0]?.changes;
      if (changes && changes[0]?.value?.messages) {
        const userId = changes[0].value.messages[0]?.from;
        if (userId) {
          return `${prefix}:${userId}`;
        }
      }
    } catch (e) {
      // Fall through to IP-based
    }
  }

  // Use IP address as fallback
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return `${prefix}:${ip}`;
}

/**
 * Sets rate limit headers on response
 * @param {Object} res - Express response
 * @param {Object} entry - Rate limit entry
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Window size in ms
 */
function setRateLimitHeaders(res, entry, maxRequests, windowMs) {
  const remaining = Math.max(0, maxRequests - entry.count);
  const resetInSeconds = Math.ceil((entry.resetTime - Date.now()) / 1000);

  res.set({
    'X-RateLimit-Limit': maxRequests,
    'X-RateLimit-Remaining': remaining,
    'X-RateLimit-Reset': resetInSeconds
  });
}

/**
 * Cleans up expired entries from the store
 * Run this periodically to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of requestStore.entries()) {
    if (now > entry.resetTime) {
      requestStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Rate limiter cleanup: removed ${cleaned} expired entries`);
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

module.exports = {
  createRateLimiter,
  cleanupExpiredEntries,
  DEFAULT_WINDOW_MS,
  DEFAULT_MAX_REQUESTS
};
