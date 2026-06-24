// Admin Authentication Middleware
// Simple API key authentication for admin routes

const rateLimiter = require('./rateLimiter');
const logger = require('../config/logger');

// Admin API key from environment
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_API_KEY) {
  logger.warn('⚠️  ADMIN_API_KEY not set. Admin routes will be unprotected!');
}

/**
 * Authenticate admin requests via API key
 */
function authenticateAdmin(req, res, next) {
  try {
    // Get API key from header or query parameter
    const apiKey = req.headers['x-admin-api-key'] || req.query.apiKey;

    if (!apiKey) {
      logger.warn('Admin access attempt without API key', {
        ip: req.ip,
        path: req.path,
      });

      return res.status(401).json({
        success: false,
        error: 'Admin API key required',
        message: 'Provide API key via X-Admin-API-Key header or ?apiKey= parameter',
      });
    }

    // Validate API key
    if (apiKey !== ADMIN_API_KEY) {
      logger.warn('Invalid admin API key attempt', {
        ip: req.ip,
        path: req.path,
        keyLength: apiKey.length,
      });

      return res.status(403).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    // Authentication successful
    req.adminAuthenticated = true;
    logger.debug('Admin authenticated', {
      ip: req.ip,
      path: req.path,
    });

    next();

  } catch (error) {
    logger.error('Admin authentication error', {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Rate limiter for admin routes
 * More restrictive to prevent abuse
 */
const adminRateLimiter = async (req, res, next) => {
  try {
    const ip = req.ip;
    const key = `admin_rate_limit:${ip}`;

    // 30 requests per minute for admin
    const result = await rateLimiter.checkRateLimit(key, 30, 60);

    if (!result.allowed) {
      logger.warn('Admin rate limit exceeded', {
        ip,
        path: req.path,
        retryAfter: result.retryAfter,
      });

      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: result.retryAfter,
      });
    }

    // Add rate limit headers
    res.set('X-RateLimit-Limit', '30');
    res.set('X-RateLimit-Remaining', result.remaining);
    res.set('X-RateLimit-Reset', new Date(Date.now() + result.retryAfter * 1000).toISOString());

    next();

  } catch (error) {
    logger.error('Admin rate limiter error', {
      error: error.message,
    });
    next(); // Allow on error (graceful degradation)
  }
};

/**
 * Mask phone number for privacy
 * Example: 919999999999 → 91****9999
 */
function maskPhoneNumber(phone) {
  if (!phone) return 'Unknown';
  
  const phoneStr = String(phone);
  
  if (phoneStr.length <= 6) {
    return phoneStr;
  }

  // Keep first 4 and last 4 characters
  const first = phoneStr.substring(0, 4);
  const last = phoneStr.substring(phoneStr.length - 4);
  const masked = '*'.repeat(phoneStr.length - 8);

  return `${first}${masked}${last}`;
}

/**
 * Mask array of phone numbers
 */
function maskPhoneNumbers(users) {
  return users.map(user => ({
    ...user,
    phone: maskPhoneNumber(user.phone || user.phoneNumber),
    phoneNumber: undefined, // Remove unmasked version
  }));
}

module.exports = {
  authenticateAdmin,
  adminRateLimiter,
  maskPhoneNumber,
  maskPhoneNumbers,
};
