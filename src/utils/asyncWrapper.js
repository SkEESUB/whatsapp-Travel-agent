// Async Wrapper Utility
// Automatically catches errors in async route handlers and passes them to error handler
// Prevents unhandled promise rejections from crashing the server

/**
 * Higher-order function that wraps async route/controller handlers
 * Catches all errors and passes them to Express error handler
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function with error handling
 * 
 * @example
 * // Without wrapper (can crash server)
 * router.post('/webhook', async (req, res, next) => {
 *   await doSomething(); // If this throws, server crashes
 * });
 * 
 * @example
 * // With wrapper (safe)
 * const asyncWrapper = require('../utils/asyncWrapper');
 * router.post('/webhook', asyncWrapper(async (req, res, next) => {
 *   await doSomething(); // If this throws, error goes to errorHandler
 * }));
 */
function asyncWrapper(fn) {
  return (req, res, next) => {
    // Execute the async function and catch any errors
    Promise.resolve(fn(req, res, next)).catch((error) => {
      // Log the error immediately
      console.error('\n' + '─'.repeat(60));
      console.error('❌ ASYNC ERROR CAUGHT BY WRAPPER');
      console.error('─'.repeat(60));
      console.error('Timestamp:', new Date().toISOString());
      console.error('Route:', req.originalUrl || req.url || 'Unknown');
      console.error('Method:', req.method || 'Unknown');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      console.error('─'.repeat(60) + '\n');

      // Pass error to Express error handler middleware
      next(error);
    });
  };
}

/**
 * Alternative: Wrap controller methods that use custom response functions
 * Specifically designed for WhatsApp webhook controllers
 * 
 * @param {Function} controllerMethod - Controller method to wrap
 * @param {Function} fallbackResponse - Fallback response function if error occurs
 * @returns {Function} - Wrapped controller method
 * 
 * @example
 * router.post('/webhook', asyncWrapperWithFallback(
 *   webhookController.handleMessage,
 *   async (req, res) => {
 *     await sendMessage(req.body.from, '⚠️ Service unavailable');
 *   }
 * ));
 */
function asyncWrapperWithFallback(controllerMethod, fallbackResponse) {
  return async (req, res, next) => {
    try {
      await controllerMethod(req, res, next);
    } catch (error) {
      // Log error
      console.error('\n' + '─'.repeat(60));
      console.error('❌ CONTROLLER ERROR CAUGHT');
      console.error('─'.repeat(60));
      console.error('Timestamp:', new Date().toISOString());
      console.error('Route:', req.originalUrl || req.url || 'Unknown');
      console.error('Error:', error.message);
      console.error('─'.repeat(60) + '\n');

      // Try fallback response
      try {
        if (fallbackResponse && typeof fallbackResponse === 'function') {
          await fallbackResponse(req, res, error);
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError.message);
      }

      // Still pass to error handler for logging
      next(error);
    }
  };
}

/**
 * Wrap service functions with automatic error handling
 * Returns fallback message instead of throwing
 * 
 * @param {Function} serviceFn - Service function to wrap
 * @param {String} fallbackMessage - User-friendly fallback message
 * @returns {Function} - Wrapped service function
 * 
 * @example
 * const getHotels = tryCatchWrapper(
 *   async (destination, budget, days) => {
 *     // Original logic
 *     const result = await gemini.generate(prompt);
 *     return result;
 *   },
 *   '⚠️ Hotel information temporarily unavailable. Please try again later.'
 * );
 */
function tryCatchWrapper(serviceFn, fallbackMessage) {
  return async (...args) => {
    try {
      return await serviceFn(...args);
    } catch (error) {
      // Log error with context
      console.error('\n' + '·'.repeat(60));
      console.error('⚠️ SERVICE ERROR CAUGHT');
      console.error('·'.repeat(60));
      console.error('Timestamp:', new Date().toISOString());
      console.error('Function:', serviceFn.name || 'Anonymous');
      console.error('Arguments:', args?.slice(0, 3) || 'None'); // First 3 args only
      console.error('Error:', error.message);
      console.error('·'.repeat(60) + '\n');

      // Return fallback message
      return fallbackMessage || '⚠️ Service temporarily unavailable. Please try again.';
    }
  };
}

/**
 * Wrap service functions that return { success, data/message } format
 * Specifically for travel engine services
 * 
 * @param {Function} serviceFn - Service function to wrap
 * @param {String} errorMessage - Error message to return on failure
 * @returns {Function} - Wrapped service function
 * 
 * @example
 * const getHotels = tryCatchWrapperStructured(
 *   async (destination, budget, days) => {
 *     const result = await hotelService.getHotels(destination, budget, days);
 *     return { success: true, data: result };
 *   },
 *   '⚠️ Hotel information temporarily unavailable.'
 * );
 */
function tryCatchWrapperStructured(serviceFn, errorMessage) {
  return async (...args) => {
    try {
      const result = await serviceFn(...args);
      
      // If service already returned error structure, pass it through
      if (result && typeof result === 'object') {
        if (result.success === false) {
          return result; // Already structured error
        }
      }
      
      return result;
    } catch (error) {
      // Log error
      console.error('\n' + '·'.repeat(60));
      console.error('⚠️ STRUCTURED SERVICE ERROR');
      console.error('·'.repeat(60));
      console.error('Timestamp:', new Date().toISOString());
      console.error('Function:', serviceFn.name || 'Anonymous');
      console.error('Error:', error.message);
      console.error('·'.repeat(60) + '\n');

      // Return structured error
      return {
        success: false,
        message: errorMessage || '⚠️ Service temporarily unavailable. Please try again.',
      };
    }
  };
}

module.exports = {
  asyncWrapper,
  asyncWrapperWithFallback,
  tryCatchWrapper,
  tryCatchWrapperStructured,
};
