// Retry Helper Utility
// Generic retry logic with exponential backoff for external API integrations

const logger = require('../config/logger');

/**
 * Retries an asynchronous function with exponential backoff
 * 
 * @param {Function} fn - The asynchronous function to retry
 * @param {Object} options - Configuration options
 * @param {number} options.retries - Maximum number of retries (default: 3)
 * @param {number} options.delay - Initial delay in milliseconds (default: 1000)
 * @param {number} options.factor - Exponential factor (default: 2)
 * @param {Function} options.onRetry - Callback function called before each retry
 * @returns {Promise<any>} The result of the function call
 */
async function retry(fn, options = {}) {
  const {
    retries = 3,
    delay = 1000,
    factor = 2,
    onRetry = null,
  } = options;

  let attempt = 0;
  let currentDelay = delay;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt > retries) {
        logger.error(`Operation failed after ${retries} retries`, {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }

      if (onRetry) {
        onRetry(error, attempt);
      }

      logger.warn(`Operation failed, retrying in ${currentDelay}ms (attempt ${attempt}/${retries})...`, {
        error: error.message,
      });

      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= factor;
    }
  }
}

module.exports = {
  retry,
};
