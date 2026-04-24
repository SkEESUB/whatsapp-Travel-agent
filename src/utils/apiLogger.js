// API Logger Utility
// Wrapper for external API calls with automatic logging

const logger = require('../config/logger');
const axios = require('axios');

/**
 * API Call Wrapper
 * Wraps any external API call with comprehensive logging
 * 
 * @param {Object} config - API call configuration
 * @param {string} config.apiName - Name of the API (e.g., 'Gemini', 'Weather', 'WhatsApp')
 * @param {string} config.endpoint - API endpoint URL
 * @param {string} [config.method='GET'] - HTTP method
 * @param {Object} [config.data] - Request body
 * @param {Object} [config.params] - Query parameters
 * @param {Object} [config.headers] - Custom headers
 * @param {number} [config.timeout=10000] - Timeout in ms (default: 10s)
 * @param {string} [config.requestId] - Request ID for tracking
 * @param {boolean} [config.logResponse=false] - Whether to log response body
 * 
 * @returns {Promise<Object>} - Axios response
 * 
 * @example
 * const response = await apiCall({
 *   apiName: 'Gemini',
 *   endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
 *   method: 'POST',
 *   data: { contents: [...] },
 *   headers: { 'Content-Type': 'application/json' },
 *   timeout: 15000,
 *   requestId: req.requestId,
 * });
 */
async function apiCall({
  apiName,
  endpoint,
  method = 'GET',
  data = null,
  params = null,
  headers = {},
  timeout = 10000,
  requestId = null,
  logResponse = false,
}) {
  const startTime = Date.now();

  // Log API call start
  logger.apiCall({
    apiName,
    endpoint,
    method,
    requestBody: data,
    requestId,
  });

  try {
    // Make API call
    const response = await axios({
      method,
      url: endpoint,
      data,
      params,
      headers,
      timeout,
    });

    const responseTime = Date.now() - startTime;

    // Log successful response
    logger.info(`API Response: ${apiName} - ${response.status}`, {
      category: 'api',
      apiName,
      endpoint,
      method,
      responseStatus: response.status,
      responseTime: `${responseTime}ms`,
      responseData: logResponse && response.data 
        ? JSON.stringify(response.data).substring(0, 1000) 
        : null,
      requestId,
    });

    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Log error details
    logger.apiCall({
      apiName,
      endpoint,
      method,
      requestBody: data,
      responseStatus: error.response?.status,
      responseTime,
      error: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      },
      requestId,
    });

    // Re-throw error for caller to handle
    throw error;
  }
}

/**
 * Simplified API Call Wrapper for Common Patterns
 * 
 * @param {string} apiName - API name
 * @param {Function} apiFunction - Function that makes the API call
 * @param {Object} metadata - Additional metadata for logging
 * @param {string} [metadata.requestId] - Request ID
 * 
 * @returns {Promise<any>} - Result from API function
 * 
 * @example
 * const result = await apiCallWrapper('Gemini', async () => {
 *   return await geminiModel.generateContent(prompt);
 * }, { requestId: req.requestId });
 */
async function apiCallWrapper(apiName, apiFunction, metadata = {}) {
  const startTime = Date.now();

  // Log API call start
  logger.info(`API Call Started: ${apiName}`, {
    category: 'api',
    apiName,
    ...metadata,
  });

  try {
    const result = await apiFunction();
    const responseTime = Date.now() - startTime;

    // Log success
    logger.info(`API Call Success: ${apiName}`, {
      category: 'api',
      apiName,
      responseTime: `${responseTime}ms`,
      ...metadata,
    });

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Log error
    logger.error(`API Call Failed: ${apiName}`, {
      category: 'api',
      apiName,
      error: error.message,
      stack: error.stack,
      responseTime: `${responseTime}ms`,
      ...metadata,
    });

    throw error;
  }
}

/**
 * Log WhatsApp Message Send
 * 
 * @param {string} to - Recipient phone number
 * @param {boolean} success - Whether send was successful
 * @param {Error} [error] - Error object if failed
 * @param {string} [requestId] - Request ID
 */
function logWhatsAppMessage(to, success, error = null, requestId = null) {
  if (success) {
    logger.info(`WhatsApp Message Sent`, {
      category: 'api',
      apiName: 'WhatsApp',
      action: 'send_message',
      to: to.substring(0, 10) + '...', // Partial for privacy
      requestId,
    });
  } else {
    logger.error(`WhatsApp Message Failed`, {
      category: 'api',
      apiName: 'WhatsApp',
      action: 'send_message',
      to: to.substring(0, 10) + '...',
      error: error?.message,
      requestId,
    });
  }
}

/**
 * Log Gemini API Call
 * 
 * @param {string} model - Gemini model name
 * @param {number} promptLength - Length of prompt
 * @param {boolean} success - Whether call was successful
 * @param {number} [responseTime] - Response time in ms
 * @param {Error} [error] - Error object if failed
 * @param {string} [requestId] - Request ID
 */
function logGeminiCall(model, promptLength, success, responseTime = null, error = null, requestId = null) {
  if (success) {
    logger.info(`Gemini API Call Success`, {
      category: 'api',
      apiName: 'Gemini',
      model,
      promptLength,
      responseTime: responseTime ? `${responseTime}ms` : null,
      requestId,
    });
  } else {
    logger.error(`Gemini API Call Failed`, {
      category: 'api',
      apiName: 'Gemini',
      model,
      promptLength,
      error: error?.message,
      stack: error?.stack,
      responseTime: responseTime ? `${responseTime}ms` : null,
      requestId,
    });
  }
}

/**
 * Log Weather API Call
 * 
 * @param {string} city - City name
 * @param {boolean} success - Whether call was successful
 * @param {Object} [weatherData] - Weather data if successful
 * @param {Error} [error] - Error object if failed
 * @param {string} [requestId] - Request ID
 */
function logWeatherCall(city, success, weatherData = null, error = null, requestId = null) {
  if (success) {
    logger.info(`Weather API Call Success`, {
      category: 'api',
      apiName: 'Weather (Open-Meteo)',
      city,
      temperature: weatherData?.temperature,
      condition: weatherData?.condition,
      requestId,
    });
  } else {
    logger.error(`Weather API Call Failed`, {
      category: 'api',
      apiName: 'Weather (Open-Meteo)',
      city,
      error: error?.message,
      requestId,
    });
  }
}

module.exports = {
  apiCall,
  apiCallWrapper,
  logWhatsAppMessage,
  logGeminiCall,
  logWeatherCall,
};
