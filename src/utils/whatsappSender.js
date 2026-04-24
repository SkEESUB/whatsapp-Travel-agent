// WhatsApp Sender Utility
// Centralized message sending with retry logic and rate limiting

const axios = require('axios');
const logger = require('../config/logger');

// Configuration
const WHATSAPP_CONFIG = {
  baseUrl: process.env.WHATSAPP_BASE_URL || 'https://graph.facebook.com/v17.0',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  
  // Rate limiting
  maxMessagesPerSecond: 80, // WhatsApp Business API limit
  messageInterval: 1000 / 80, // ~12.5ms between messages
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // Start with 1s
};

// Rate limiter state
let messageCount = 0;
let lastResetTime = Date.now();
const RATE_LIMIT_WINDOW = 1000; // 1 second

/**
 * Send WhatsApp message with retry logic
 */
async function sendMessage(phoneNumber, message, options = {}) {
  const { retryCount = 0, isRetry = false } = options;

  try {
    // Rate limiting check
    await enforceRateLimit();

    // Format message for WhatsApp API
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message,
      },
    };

    // Send message
    const response = await axios.post(
      `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 seconds timeout
      }
    );

    // Log success
    logger.info('✅ WhatsApp message sent', {
      phoneNumber,
      messageId: response.data?.messages?.[0]?.id,
      messageLength: message.length,
      retryCount,
    });

    return {
      success: true,
      messageId: response.data?.messages?.[0]?.id,
    };

  } catch (error) {
    logger.error('❌ WhatsApp message send failed', {
      phoneNumber,
      error: error.message,
      statusCode: error.response?.status,
      retryCount,
    });

    // Handle rate limit error from WhatsApp
    if (error.response?.status === 429) {
      logger.warn('⚠️ WhatsApp rate limit hit, waiting...');
      await delay(5000); // Wait 5 seconds
      
      if (retryCount < WHATSAPP_CONFIG.maxRetries) {
        return sendMessage(phoneNumber, message, {
          retryCount: retryCount + 1,
          isRetry: true,
        });
      }
    }

    // Retry on network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      if (retryCount < WHATSAPP_CONFIG.maxRetries) {
        const delayTime = WHATSAPP_CONFIG.retryDelay * Math.pow(2, retryCount);
        logger.info(`Retrying message send in ${delayTime}ms`, {
          phoneNumber,
          retryCount: retryCount + 1,
        });
        
        await delay(delayTime);
        
        return sendMessage(phoneNumber, message, {
          retryCount: retryCount + 1,
          isRetry: true,
        });
      }
    }

    // Max retries exceeded or other error
    return {
      success: false,
      error: error.message,
      retryCount,
    };
  }
}

/**
 * Enforce rate limiting
 */
async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceReset = now - lastResetTime;

  // Reset counter every second
  if (timeSinceReset >= RATE_LIMIT_WINDOW) {
    messageCount = 0;
    lastResetTime = now;
  }

  // Check if we've hit the limit
  if (messageCount >= WHATSAPP_CONFIG.maxMessagesPerSecond) {
    const waitTime = RATE_LIMIT_WINDOW - timeSinceReset;
    logger.debug('Rate limit reached, waiting', {
      waitTime,
      messageCount,
    });
    
    await delay(waitTime);
    
    // Reset after waiting
    messageCount = 0;
    lastResetTime = Date.now();
  }

  // Increment counter
  messageCount++;
}

/**
 * Send multiple messages (batch)
 */
async function sendBatchMessages(phoneNumbers, message) {
  const results = [];

  for (const phoneNumber of phoneNumbers) {
    try {
      const result = await sendMessage(phoneNumber, message);
      results.push({
        phoneNumber,
        success: result.success,
        error: result.error,
      });
    } catch (error) {
      results.push({
        phoneNumber,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Send message template (WhatsApp approved templates)
 */
async function sendTemplate(phoneNumber, templateName, components = []) {
  try {
    await enforceRateLimit();

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en',
        },
        components: components,
      },
    };

    const response = await axios.post(
      `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    logger.info('✅ Template message sent', {
      phoneNumber,
      template: templateName,
      messageId: response.data?.messages?.[0]?.id,
    });

    return {
      success: true,
      messageId: response.data?.messages?.[0]?.id,
    };
  } catch (error) {
    logger.error('❌ Template message send failed', {
      phoneNumber,
      template: templateName,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send typing indicator (simulated)
 */
async function sendTypingIndicator(phoneNumber, duration = 2000) {
  // WhatsApp doesn't support typing indicators via API
  // This is a placeholder for future functionality
  logger.debug('Typing indicator requested', { phoneNumber, duration });
}

/**
 * Delay utility
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get rate limit status
 */
function getRateLimitStatus() {
  return {
    messageCount,
    maxMessagesPerSecond: WHATSAPP_CONFIG.maxMessagesPerSecond,
    window: RATE_LIMIT_WINDOW,
    lastResetTime,
  };
}

/**
 * Test WhatsApp connection
 */
async function testConnection() {
  try {
    const response = await axios.get(
      `${WHATSAPP_CONFIG.baseUrl}/${WHATSAPP_CONFIG.phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_CONFIG.accessToken}`,
        },
        timeout: 5000,
      }
    );

    logger.info('✅ WhatsApp connection test successful', {
      phoneNumberId: response.data?.id,
      name: response.data?.display_phone_number,
    });

    return { success: true, data: response.data };
  } catch (error) {
    logger.error('❌ WhatsApp connection test failed', {
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  sendMessage,
  sendBatchMessages,
  sendTemplate,
  sendTypingIndicator,
  getRateLimitStatus,
  testConnection,
  WHATSAPP_CONFIG,
};
