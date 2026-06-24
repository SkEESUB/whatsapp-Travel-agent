// Production-Grade Winston Logger Configuration
// Features: JSON format, multiple transports, log rotation, request ID tracking

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('📁 Logs directory created:', logsDir);
}

// Custom format for console output (colorized, human-readable)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const base = `[${timestamp}] ${level}: ${message}`;
    const reqId = requestId ? ` [${requestId}]` : '';
    const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : '';
    return `${base}${reqId}${metaStr}`;
  })
);

// Custom format for file output (pure JSON)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'ISO8601' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Log levels configuration
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Default: info
  levels: logLevels,
  format: fileFormat,
  defaultMeta: {
    service: 'whatsapp-travel-bot',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // 1. Console Transport (for development)
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
    }),

    // 2. Error Log - Only errors (for production monitoring)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
    }),

    // 3. Combined Log - Everything (for debugging)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'debug',
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
    }),

    // 4. API Log - External API calls only
    new winston.transports.File({
      filename: path.join(logsDir, 'api.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format((info) => {
          // Only log API-related messages
          if (info.category === 'api' || info.apiName) {
            return info;
          }
          return false; // Filter out non-API logs
        })(),
        fileFormat
      ),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
      tailable: true,
    }),
  ],

  // Exit on error (optional - set false for production)
  exitOnError: false,
});

// Create a stream for Morgan (HTTP request logging)
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

const originalChild = logger.child;
logger.child = function (options) {
  if (typeof options === 'string') {
    return originalChild.call(logger, { requestId: options });
  }
  return originalChild.call(logger, options);
};

// Helper: Log API calls with structured data
logger.apiCall = function ({
  apiName,
  endpoint,
  method = 'GET',
  requestBody = null,
  responseStatus = null,
  responseBody = null,
  responseTime = null,
  error = null,
  requestId = null,
}) {
  const logData = {
    category: 'api',
    apiName,
    endpoint,
    method,
    responseStatus,
    responseTime: responseTime ? `${responseTime}ms` : null,
  };

  if (error) {
    logger.error(`API Call Failed: ${apiName} - ${endpoint}`, {
      ...logData,
      error: error.message,
      stack: error.stack,
      requestId,
    });
  } else {
    logger.info(`API Call: ${apiName} - ${endpoint}`, {
      ...logData,
      requestBody: requestBody ? JSON.stringify(requestBody).substring(0, 500) : null,
      requestId,
    });
  }
};

// Helper: Log external service calls
logger.serviceCall = function ({
  serviceName,
  action,
  params = {},
  success = true,
  error = null,
  duration = null,
  requestId = null,
}) {
  const message = success
    ? `Service Call: ${serviceName} - ${action}`
    : `Service Call Failed: ${serviceName} - ${action}`;

  const level = success ? 'info' : 'error';

  logger[level](message, {
    category: 'service',
    serviceName,
    action,
    params: JSON.stringify(params).substring(0, 300), // Truncate for privacy
    success,
    duration: duration ? `${duration}ms` : null,
    error: error?.message || null,
    requestId,
  });
};

// Helper: Log user actions
logger.userAction = function ({
  userId,
  action,
  details = {},
  requestId = null,
}) {
  logger.info(`User Action: ${userId} - ${action}`, {
    category: 'user',
    userId,
    action,
    details: JSON.stringify(details).substring(0, 500),
    requestId,
  });
};

// Helper: Log business events
logger.businessEvent = function ({
  event,
  data = {},
  requestId = null,
}) {
  logger.info(`Business Event: ${event}`, {
    category: 'business',
    event,
    data: JSON.stringify(data).substring(0, 500),
    requestId,
  });
};

// Suppress deprecation warnings in production
if (process.env.NODE_ENV === 'production') {
  process.noDeprecation = true;
}

// Log startup
logger.info('Logger initialized successfully', {
  logLevel: logger.level,
  environment: process.env.NODE_ENV || 'development',
  transports: logger.transports.length,
});

module.exports = logger;
