/**
 * WhatsApp Service
 * Handles sending messages back to users via WhatsApp Cloud API
 */

const https = require('https');

// WhatsApp API configuration
const WHATSAPP_API_VERSION = 'v18.0';
const BASE_URL = `graph.facebook.com`;

/**
 * Sends a text message to a WhatsApp user
 * @param {string} to - Recipient's WhatsApp ID (phone number)
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} API response
 */
async function sendTextMessage(to, message) {
  if (!to || typeof to !== 'string') {
    throw new Error('Invalid recipient: to is required');
  }

  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message: message is required');
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error('WhatsApp credentials not configured');
    // Simulate success in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MOCK] Would send to ${to}: ${message.substring(0, 100)}...`);
      return { success: true, mock: true };
    }
    throw new Error('WhatsApp credentials not configured');
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      preview_url: false,
      body: message
    }
  };

  try {
    const response = await makeApiRequest(
      `/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
      'POST',
      payload,
      accessToken
    );

    console.log(`✅ Message sent to ${to}`);
    return response;

  } catch (error) {
    console.error('Failed to send WhatsApp message:', error.message);
    throw error;
  }
}

/**
 * Sends a template message (for welcome, notifications, etc.)
 * @param {string} to - Recipient's WhatsApp ID
 * @param {string} templateName - Name of the approved template
 * @param {string} languageCode - Language code (default: en)
 * @returns {Promise<Object>} API response
 */
async function sendTemplateMessage(to, templateName, languageCode = 'en') {
  if (!to || !templateName) {
    throw new Error('Recipient and template name are required');
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error('WhatsApp credentials not configured');
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MOCK] Would send template "${templateName}" to ${to}`);
      return { success: true, mock: true };
    }
    throw new Error('WhatsApp credentials not configured');
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      }
    }
  };

  return makeApiRequest(
    `/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
    'POST',
    payload,
    accessToken
  );
}

/**
 * Marks a message as read
 * @param {string} messageId - ID of the message to mark as read
 * @returns {Promise<Object>} API response
 */
async function markMessageAsRead(messageId) {
  if (!messageId) {
    throw new Error('Message ID is required');
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, reason: 'credentials_not_configured' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  };

  return makeApiRequest(
    `/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
    'POST',
    payload,
    accessToken
  );
}

/**
 * Makes an HTTPS request to the WhatsApp API
 * @param {string} path - API endpoint path
 * @param {string} method - HTTP method
 * @param {Object} payload - Request body
 * @param {string} accessToken - Bearer token
 * @returns {Promise<Object>} Parsed response
 */
function makeApiRequest(path, method, payload, accessToken) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: BASE_URL,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`API Error ${res.statusCode}: ${parsed.error?.message || responseData}`));
          }
        } catch (e) {
          reject(new Error(`Invalid response: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Gets the WhatsApp Business Account info
 * @returns {Promise<Object>} Account information
 */
async function getAccountInfo() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('WhatsApp access token not configured');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/${WHATSAPP_API_VERSION}/me?fields=id,name`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
  markMessageAsRead,
  getAccountInfo,
  makeApiRequest
};
