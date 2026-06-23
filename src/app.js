// =====================
// LOAD ENV (MUST BE FIRST)
// =====================
require("dotenv").config();

// =====================
// IMPORT LOGGER (Before anything else)
// =====================
const logger = require("./config/logger");
const { requestLogger } = require("./middleware/requestLogger");

// =====================
// APP SETUP
// =====================
const express = require("express");
const app = express();

app.use(express.json());

// =====================
// PROCESS-LEVEL ERROR HANDLERS
// These prevent the server from crashing on unhandled errors
// =====================

// Handle uncaught exceptions (synchronous errors not caught anywhere)
process.on('uncaughtException', (error) => {
  logger.error('UNCAUGHT EXCEPTION DETECTED', {
    category: 'process',
    message: error.message,
    stack: error.stack,
  });
  
  // DO NOT exit - keep server running
  logger.warn('Server continuing despite uncaught exception');
});

// Handle unhandled promise rejections (async errors not caught)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED PROMISE REJECTION', {
    category: 'process',
    reason: reason?.message || reason,
    promise: promise?.toString(),
  });
  
  // DO NOT exit - keep server running
  logger.warn('Server continuing despite unhandled rejection');
});

// =====================
// REQUEST LOGGER (Must be after express.json())
// =====================
app.use(requestLogger);

// =====================
// DEBUG (ONCE)
// =====================
logger.info("Environment loaded successfully");
logger.info("Process error handlers registered");
logger.info("Request logger middleware active");
logger.debug("VERIFY TOKEN FROM ENV:", { 
  tokenConfigured: !!process.env.WHATSAPP_VERIFY_TOKEN 
});

// =====================
// ROUTES
// =====================
const webhookRoutes = require("./routes/webhook");
const adminRoutes = require("./routes/admin");
const healthRoutes = require("./routes/health");
const paymentRoutes = require("./routes/payment");
const linkShortener = require("./utils/linkShortener");
const AffiliateClick = require("./models/AffiliateClick");

app.use("/webhook", webhookRoutes);
app.use("/admin", adminRoutes);
app.use("/health", healthRoutes);
app.use("/payment", paymentRoutes);

// Short Link redirect endpoint
app.get("/l/:code", async (req, res, next) => {
  try {
    const code = req.params.code;
    const result = await linkShortener.getUrl(code);
    
    if (!result) {
      return res.status(404).send("Link expired or not found");
    }
    
    // Track click if metadata exists
    if (result.metadata && Object.keys(result.metadata).length > 0) {
      try {
        const { userPhoneHash, platform, linkType, destination, source, tripId } = result.metadata;
        await AffiliateClick.trackClick({
          userPhoneHash: userPhoneHash || 'anonymous',
          platform: platform || 'makemytrip',
          linkType: linkType || 'hotel',
          destination: destination || 'unknown',
          source: source || '',
          tripId,
          metadata: {
            userAgent: req.headers['user-agent'],
            referrer: req.headers['referer'],
          }
        });
        logger.info('Affiliate link click tracked successfully', { platform, destination });
      } catch (err) {
        logger.error('Failed to track affiliate click on redirect', { error: err.message });
      }
    }
    
    return res.redirect(result.longUrl);
  } catch (error) {
    next(error);
  }
});


// =====================
// ERROR HANDLING MIDDLEWARE (MUST BE LAST)
// =====================
const ErrorHandler = require('./middleware/errorHandler');

// 404 handler - must be after all routes
app.use(ErrorHandler.notFoundHandler());

// Global error handler - must be the very last middleware
app.use(ErrorHandler.handle());

// =====================
// START SERVER
// =====================
const database = require("./config/database");

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  logger.info('\n' + '='.repeat(60));
  logger.info('🚀 SERVER STARTED SUCCESSFULLY');
  logger.info('='.repeat(60));
  logger.info(`Port: ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Log Level: ${logger.level}`);
  logger.info('Error Handling: ENABLED (production-grade)');
  logger.info('Process Handlers: ENABLED (uncaughtException, unhandledRejection)');
  logger.info('Request Logging: ENABLED (with request ID tracking)');
  logger.info('API Logging: ENABLED (Gemini, Weather, WhatsApp)');
  logger.info('='.repeat(60) + '\n');

  // Connect to MongoDB
  try {
    await database.connect();
  } catch (err) {
    logger.error('Initial MongoDB connection failed. Database features may be unavailable.', {
      error: err.message
    });
  }
});

// Graceful shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn(`${signal} received but already shutting down...`);
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Step 1: Stop accepting new connections
  logger.info('Step 1: Stopping HTTP server (no new connections)...');
  
  server.close(async () => {
    logger.info('HTTP server closed - no longer accepting connections');

    try {
      // Step 2: Wait for current queue jobs to finish (max 10 seconds)
      logger.info('Step 2: Waiting for queue jobs to complete...');
      
      try {
        const { getQueue } = require('./queue/messageQueue');
        const queue = getQueue();
        
        if (queue) {
          // Wait for active jobs to complete (with timeout)
          await Promise.race([
            queue.whenCurrentJobsFinished(),
            new Promise(resolve => setTimeout(resolve, 10000)) // 10s timeout
          ]);
          logger.info('Queue jobs finished or timed out');
        }
      } catch (error) {
        logger.warn('Queue shutdown warning', { error: error.message });
      }

      // Step 3: Close Redis connection
      logger.info('Step 3: Closing Redis connection...');
      
      try {
        const redis = require('./config/redis');
        await redis.disconnect();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.warn('Redis shutdown warning', { error: error.message });
      }

      // Step 4: Close MongoDB connection
      logger.info('Step 4: Closing MongoDB connection...');
      
      try {
        const database = require('./config/database');
        await database.disconnect();
        logger.info('MongoDB connection closed');
      } catch (error) {
        logger.warn('MongoDB shutdown warning', { error: error.message });
      }

      // Step 5: Exit process
      logger.info('Step 5: All connections closed. Exiting process...');
      logger.info('Graceful shutdown completed successfully');
      
      process.exit(0);

    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error.message,
        stack: error.stack,
      });
      
      // Force exit on error
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forcing shutdown after 30 second timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
