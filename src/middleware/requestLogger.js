// Request Logger Middleware
// Logs every incoming webhook request with timing and sanitization

const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Request Logger Middleware
 * Attaches request ID, logs request details, and tracks response time
 */
function requestLogger(req, res, next) {
  // Generate unique request ID
  const requestId = uuidv4();
  req.requestId = requestId;

  // Record start time
  const startTime = Date.now();

  // Sanitize request body (remove sensitive data, truncate)
  const sanitizeBody = (body) => {
    if (!body) return null;

    // Create shallow copy
    const sanitized = { ...body };

    // Remove sensitive fields
    delete sanitized.access_token;
    delete sanitized.token;
    delete sanitized.authorization;
    delete sanitized.password;
    delete sanitized.secret;

    // Truncate to first 200 chars for logging
    const bodyStr = JSON.stringify(sanitized);
    return bodyStr.length > 200 ? bodyStr.substring(0, 200) + '...' : bodyStr;
  };

  // Log incoming request
  const bodyPreview = sanitizeBody(req.body);
  
  logger.info(`${req.method} ${req.originalUrl}`, {
    category: 'http',
    method: req.method,
    path: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    bodyPreview: req.method === 'POST' ? bodyPreview : null,
    requestId,
  });

  // Log response when finished
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;

    logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode}`, {
      category: 'http',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      requestId,
    });
  });

  // Add request ID to response headers (useful for debugging)
  res.set('X-Request-ID', requestId);

  next();
}

/**
 * Error Request Logger
 * Logs requests that result in errors
 */
function errorRequestLogger(err, req, res, next) {
  const requestId = req.requestId || uuidv4();

  logger.error(`Request Error: ${req.method} ${req.originalUrl}`, {
    category: 'http',
    method: req.method,
    path: req.originalUrl,
    statusCode: err.statusCode || err.status || 500,
    error: err.message,
    stack: err.stack,
    requestId,
  });

  next(err);
}

module.exports = {
  requestLogger,
  errorRequestLogger,
};
