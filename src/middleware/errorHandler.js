// Global Error Handler Middleware
// Catches all synchronous and asynchronous errors
// Ensures server NEVER crashes and always returns safe responses

class ErrorHandler {
  /**
   * Format error for logging (detailed, for developers)
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @returns {Object} - Structured error log
   */
  static formatErrorLog(err, req) {
    return {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: err.message || 'Unknown error',
      stack: err.stack || 'No stack trace',
      route: req?.originalUrl || req?.url || 'Unknown route',
      method: req?.method || 'Unknown method',
      ip: req?.ip || req?.connection?.remoteAddress || 'Unknown IP',
      userAgent: req?.headers?.['user-agent'] || 'Unknown',
    };
  }

  /**
   * Categorize error type for appropriate response
   * @param {Error} err - Error object
   * @returns {String} - Error category
   */
  static categorizeError(err) {
    const message = err.message?.toLowerCase() || '';
    const code = err.code || err.status || err.statusCode;

    // Gemini API errors
    if (message.includes('gemini') || message.includes('generative') || message.includes('generativelanguage')) {
      return 'GEMINI_API';
    }

    // WhatsApp API errors
    if (message.includes('whatsapp') || message.includes('graph.facebook') || message.includes('messaging')) {
      return 'WHATSAPP_API';
    }

    // Network/Timeout errors
    if (message.includes('timeout') || message.includes('econnreset') || message.includes('enetunreach')) {
      return 'NETWORK_TIMEOUT';
    }

    // JSON parsing errors
    if (message.includes('json') || code === 400) {
      return 'INVALID_JSON';
    }

    // Rate limiting
    if (code === 429 || message.includes('rate limit')) {
      return 'RATE_LIMIT';
    }

    // Not found
    if (code === 404) {
      return 'NOT_FOUND';
    }

    // Authentication errors
    if (code === 401 || code === 403 || message.includes('unauthorized') || message.includes('forbidden')) {
      return 'AUTH_ERROR';
    }

    return 'UNKNOWN';
  }

  /**
   * Get user-friendly message based on error type
   * @param {String} errorCategory - Error category
   * @returns {String} - WhatsApp-friendly message
   */
  static getUserMessage(errorCategory) {
    const messages = {
      GEMINI_API: '⚠️ AI service is temporarily busy. Please try again in a moment.',
      WHATSAPP_API: '⚠️ Message service unavailable. Please try again.',
      NETWORK_TIMEOUT: '⚠️ Request timed out. Please check your connection and try again.',
      INVALID_JSON: '❌ Invalid request format. Please send a valid message.',
      RATE_LIMIT: '⏳ Too many requests. Please wait a moment before trying again.',
      NOT_FOUND: '❌ Service not found. Please check your request.',
      AUTH_ERROR: '❌ Authentication failed. Please contact support.',
      UNKNOWN: '⚠️ Service temporarily unavailable. Please try again.',
    };

    return messages[errorCategory] || messages.UNKNOWN;
  }

  /**
   * Global Express error handler middleware
   * Must be added as LAST middleware in app.js
   */
  static handle() {
    return (err, req, res, next) => {
      // Format and log error details
      const errorLog = this.formatErrorLog(err, req);
      const errorCategory = this.categorizeError(err);

      // Log to console (in production, use Winston/Pino)
      console.error('\n' + '='.repeat(60));
      console.error('❌ ERROR CAUGHT BY GLOBAL HANDLER');
      console.error('='.repeat(60));
      console.error('Category:', errorCategory);
      console.error('Timestamp:', errorLog.timestamp);
      console.error('Route:', errorLog.route);
      console.error('Method:', errorLog.method);
      console.error('Message:', errorLog.message);
      console.error('Stack:', errorLog.stack);
      console.error('='.repeat(60) + '\n');

      // If headers already sent, cannot send response
      if (res.headersSent) {
        console.warn('⚠️ Headers already sent, cannot send error response');
        return next(err);
      }

      // Determine response status
      const status = err.statusCode || err.status || 500;

      // For webhook routes (WhatsApp), always return 200 to prevent retries
      if (req.path?.includes('webhook')) {
        res.status(200).json({
          success: false,
          error: 'Error handled',
        });
        return;
      }

      // For API routes, return appropriate status
      res.status(status).json({
        success: false,
        error: this.getUserMessage(errorCategory),
        category: errorCategory,
        timestamp: errorLog.timestamp,
      });
    };
  }

  /**
   * Handle 404 - Route not found
   */
  static notFoundHandler() {
    return (req, res, next) => {
      const errorLog = {
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        route: req.originalUrl,
        method: req.method,
        ip: req.ip || req.connection?.remoteAddress,
      };

      console.warn('\n' + '-'.repeat(60));
      console.warn('⚠️ 404 NOT FOUND');
      console.warn('-'.repeat(60));
      console.warn('Timestamp:', errorLog.timestamp);
      console.warn('Route:', errorLog.route);
      console.warn('Method:', errorLog.method);
      console.warn('-'.repeat(60) + '\n');

      // For webhook routes
      if (req.path?.includes('webhook')) {
        return res.status(200).json({
          success: false,
          error: 'Webhook endpoint not found',
        });
      }

      // For API routes
      res.status(404).json({
        success: false,
        error: '❌ Route not found',
        route: req.originalUrl,
        timestamp: errorLog.timestamp,
      });
    };
  }

  /**
   * Handle invalid JSON body parsing errors
   */
  static handleJSONError(err, req, res, next) {
    if (err.type === 'entity.parse.failed') {
      const errorLog = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: 'Invalid JSON body received',
        route: req.originalUrl,
        method: req.method,
        body: req.body,
      };

      console.error('\n' + '-'.repeat(60));
      console.error('❌ INVALID JSON BODY');
      console.error('-'.repeat(60));
      console.error('Timestamp:', errorLog.timestamp);
      console.error('Route:', errorLog.route);
      console.error('Body:', errorLog.body);
      console.error('-'.repeat(60) + '\n');

      if (req.path?.includes('webhook')) {
        return res.status(200).json({
          success: false,
          error: 'Invalid request format',
        });
      }

      return res.status(400).json({
        success: false,
        error: '❌ Invalid JSON format',
        timestamp: errorLog.timestamp,
      });
    }

    // Pass to next error handler
    next(err);
  }
}

module.exports = ErrorHandler;
