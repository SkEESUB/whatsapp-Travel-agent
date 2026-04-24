// Rate Limiter Middleware
// Per-user and global rate limiting using Redis sliding window algorithm

const logger = require('../config/logger');
const { getRedisClient, isRedisConnected, executeCommand } = require('../config/redis');

// Configuration
const RATE_LIMIT_CONFIG = {
  // Per-user limits
  user: {
    perMinute: 30,
    perHour: 200,
    perDay: 500,
  },
  
  // Global limits
  global: {
    perMinute: 1000,
  },
  
  // Key prefixes
  keys: {
    userMinute: 'rl:user:minute:',
    userHour: 'rl:user:hour:',
    userDay: 'rl:user:day:',
    globalMinute: 'rl:global:minute:',
  },
};

/**
 * Sliding window rate limiter using Redis
 */
async function checkRateLimit(key, limit, windowSeconds) {
  try {
    if (!isRedisConnected()) {
      // If Redis is down, allow request (don't block users)
      logger.warn('Redis down, rate limit check skipped', { key });
      return { allowed: true, remaining: limit };
    }

    const client = getRedisClient();
    if (!client) {
      return { allowed: true, remaining: limit };
    }

    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Use Redis multi/pipeline for atomic operations
    const pipeline = client.pipeline();
    
    // Remove old entries outside window
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries in window
    pipeline.zcard(key);
    
    // Add current request
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry on key
    pipeline.expire(key, windowSeconds + 60); // Extra 60s buffer

    const results = await pipeline.exec();
    
    // Current count (before adding this request)
    const currentCount = results[1][1];
    
    if (currentCount >= limit) {
      // Rate limit exceeded
      const oldestInWindow = await client.zrange(key, 0, 0, 'WITHSCORES');
      let retryAfter = windowSeconds;
      
      if (oldestInWindow && oldestInWindow[1]) {
        const oldestTimestamp = parseInt(oldestInWindow[1]);
        retryAfter = Math.ceil((oldestTimestamp + (windowSeconds * 1000) - now) / 1000);
      }

      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        currentCount,
        limit,
      };
    }

    return {
      allowed: true,
      remaining: limit - currentCount - 1,
      currentCount: currentCount + 1,
      limit,
    };

  } catch (error) {
    logger.error('Rate limit check error', {
      key,
      error: error.message,
    });
    
    // On error, allow request (fail-open)
    return { allowed: true, remaining: limit };
  }
}

/**
 * Check per-user rate limits
 */
async function checkUserRateLimit(phoneNumber) {
  const results = {};
  
  // Check per-minute limit
  const minuteKey = `${RATE_LIMIT_CONFIG.keys.userMinute}${phoneNumber}`;
  results.minute = await checkRateLimit(
    minuteKey,
    RATE_LIMIT_CONFIG.user.perMinute,
    60
  );
  
  // Check per-hour limit
  const hourKey = `${RATE_LIMIT_CONFIG.keys.userHour}${phoneNumber}`;
  results.hour = await checkRateLimit(
    hourKey,
    RATE_LIMIT_CONFIG.user.perHour,
    3600
  );
  
  // Check per-day limit
  const dayKey = `${RATE_LIMIT_CONFIG.keys.userDay}${phoneNumber}`;
  results.day = await checkRateLimit(
    dayKey,
    RATE_LIMIT_CONFIG.user.perDay,
    86400
  );
  
  // User is rate limited if ANY limit is exceeded
  const isLimited = !results.minute.allowed || !results.hour.allowed || !results.day.allowed;
  
  if (isLimited) {
    // Calculate longest wait time
    const retryAfter = Math.max(
      results.minute.retryAfter || 0,
      results.hour.retryAfter || 0,
      results.day.retryAfter || 0,
    );
    
    logger.warn('⚠️ User rate limited', {
      phoneNumber,
      minuteCount: results.minute.currentCount,
      hourCount: results.hour.currentCount,
      dayCount: results.day.currentCount,
      retryAfter,
    });
    
    return {
      allowed: false,
      retryAfter,
      limits: results,
    };
  }
  
  return {
    allowed: true,
    limits: results,
  };
}

/**
 * Check global rate limit
 */
async function checkGlobalRateLimit() {
  const globalKey = RATE_LIMIT_CONFIG.keys.globalMinute;
  
  const result = await checkRateLimit(
    globalKey,
    RATE_LIMIT_CONFIG.global.perMinute,
    60
  );
  
  if (!result.allowed) {
    logger.warn('⚠️ Global rate limit exceeded', {
      count: result.currentCount,
      limit: result.limit,
    });
  }
  
  return result;
}

/**
 * Express middleware for rate limiting
 */
function rateLimiter(req, res, next) {
  const phoneNumber = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
  
  // Skip rate limit check if no phone number (e.g., webhook verification)
  if (!phoneNumber) {
    return next();
  }
  
  // Check global rate limit first
  checkGlobalRateLimit().then(globalResult => {
    if (!globalResult.allowed) {
      // Global limit exceeded - still return 200 to WhatsApp
      logger.warn('Global rate limit hit, returning 200 to WhatsApp');
      return res.status(200).json({
        status: 'rate_limited',
        message: 'Server temporarily busy. Please try again.',
      });
    }
    
    // Check per-user rate limit
    checkUserRateLimit(phoneNumber).then(userResult => {
      if (!userResult.allowed) {
        // User rate limited - send friendly message via WhatsApp
        const waitMinutes = Math.ceil(userResult.retryAfter / 60);
        
        logger.info('🚫 User rate limited, sending friendly message', {
          phoneNumber,
          retryAfter: userResult.retryAfter,
        });
        
        // Still return 200 to WhatsApp (webhook requirement)
        return res.status(200).json({
          status: 'rate_limited',
          message: `You're sending too many messages. Please wait ${waitMinutes} minute(s).`,
          retryAfter: userResult.retryAfter,
        });
      }
      
      // All checks passed
      next();
    }).catch(error => {
      logger.error('User rate limit check error', {
        error: error.message,
      });
      // Fail-open: allow request on error
      next();
    });
  }).catch(error => {
    logger.error('Global rate limit check error', {
      error: error.message,
    });
    // Fail-open: allow request on error
    next();
  });
}

/**
 * Get user's current rate limit status
 */
async function getUserRateLimitStatus(phoneNumber) {
  const minuteKey = `${RATE_LIMIT_CONFIG.keys.userMinute}${phoneNumber}`;
  const hourKey = `${RATE_LIMIT_CONFIG.keys.userHour}${phoneNumber}`;
  const dayKey = `${RATE_LIMIT_CONFIG.keys.userDay}${phoneNumber}`;
  
  try {
    const [minuteCount, hourCount, dayCount] = await Promise.all([
      executeCommand('zcard', minuteKey),
      executeCommand('zcard', hourKey),
      executeCommand('zcard', dayKey),
    ]);
    
    return {
      minute: {
        used: minuteCount || 0,
        limit: RATE_LIMIT_CONFIG.user.perMinute,
        remaining: Math.max(0, RATE_LIMIT_CONFIG.user.perMinute - (minuteCount || 0)),
      },
      hour: {
        used: hourCount || 0,
        limit: RATE_LIMIT_CONFIG.user.perHour,
        remaining: Math.max(0, RATE_LIMIT_CONFIG.user.perHour - (hourCount || 0)),
      },
      day: {
        used: dayCount || 0,
        limit: RATE_LIMIT_CONFIG.user.perDay,
        remaining: Math.max(0, RATE_LIMIT_CONFIG.user.perDay - (dayCount || 0)),
      },
    };
  } catch (error) {
    logger.error('Failed to get rate limit status', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Reset rate limits for a user (admin function)
 */
async function resetUserRateLimit(phoneNumber) {
  try {
    const minuteKey = `${RATE_LIMIT_CONFIG.keys.userMinute}${phoneNumber}`;
    const hourKey = `${RATE_LIMIT_CONFIG.keys.userHour}${phoneNumber}`;
    const dayKey = `${RATE_LIMIT_CONFIG.keys.userDay}${phoneNumber}`;
    
    await Promise.all([
      executeCommand('del', minuteKey),
      executeCommand('del', hourKey),
      executeCommand('del', dayKey),
    ]);
    
    logger.info('User rate limits reset', { phoneNumber });
    return true;
  } catch (error) {
    logger.error('Failed to reset user rate limit', {
      error: error.message,
    });
    return false;
  }
}

module.exports = {
  rateLimiter,
  checkUserRateLimit,
  checkGlobalRateLimit,
  getUserRateLimitStatus,
  resetUserRateLimit,
  RATE_LIMIT_CONFIG,
};
