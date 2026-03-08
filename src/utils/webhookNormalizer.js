/**
 * Webhook Normalizer Utility
 * Transforms WhatsApp Cloud API webhook payload into normalized format
 */

/**
 * Normalizes WhatsApp webhook payload
 * @param {Object} payload - Raw webhook payload from WhatsApp Cloud API
 * @returns {Object|null} Normalized message object or null if invalid/non-text
 * @returns {string} return.userId - WhatsApp ID of the sender
 * @returns {string} return.messageText - Text content of the message
 * @returns {string} return.timestamp - ISO timestamp of the message
 */
function normalizeWebhookPayload(payload) {
  // Defensive checks for payload structure
  if (!payload || typeof payload !== 'object') {
    console.warn('Invalid payload: not an object');
    return null;
  }

  // Check for entry array
  if (!Array.isArray(payload.entry) || payload.entry.length === 0) {
    console.warn('Invalid payload: missing or empty entry array');
    return null;
  }

  const entry = payload.entry[0];

  // Check for changes array
  if (!Array.isArray(entry.changes) || entry.changes.length === 0) {
    console.warn('Invalid payload: missing or empty changes array');
    return null;
  }

  const change = entry.changes[0];

  // Check for value object
  if (!change.value || typeof change.value !== 'object') {
    console.warn('Invalid payload: missing value object');
    return null;
  }

  const value = change.value;

  // Check for messages array
  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    // No messages in this update (could be status update)
    return null;
  }

  const message = value.messages[0];

  // Extract user ID (WhatsApp ID)
  const userId = message.from;
  if (!userId || typeof userId !== 'string') {
    console.warn('Invalid payload: missing or invalid sender ID');
    return null;
  }

  // Check message type - only process text messages
  if (message.type !== 'text') {
    console.log(`Message type "${message.type}" ignored - only text supported`);
    return null;
  }

  // Extract text content
  if (!message.text || typeof message.text.body !== 'string') {
    console.warn('Invalid payload: missing or invalid text body');
    return null;
  }

  const messageText = message.text.body.trim();
  
  // Skip empty messages
  if (messageText.length === 0) {
    console.log('Empty message ignored');
    return null;
  }

  // Extract and convert timestamp
  // WhatsApp sends timestamp in seconds, convert to milliseconds for Date
  const timestampSeconds = parseInt(message.timestamp, 10);
  if (isNaN(timestampSeconds)) {
    console.warn('Invalid payload: malformed timestamp');
    return null;
  }

  const timestamp = new Date(timestampSeconds * 1000).toISOString();

  // Return normalized object
  return {
    userId,
    messageText,
    timestamp
  };
}

module.exports = {
  normalizeWebhookPayload
};
