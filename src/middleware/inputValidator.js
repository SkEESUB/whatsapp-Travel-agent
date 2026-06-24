// Input Validator Middleware
// Validates and sanitizes all incoming webhook requests
// Protects against spam, injection, and malformed data

const logger = require('../config/logger');

// Configuration
const MAX_MESSAGE_LENGTH = 500;
const MIN_MESSAGE_LENGTH = 1;

/**
 * Validate webhook payload structure
 * Ensures WhatsApp webhook format is correct
 */
function validateWebhookPayload(req, res, next) {
  const requestId = req.requestId || 'unknown';

  try {
    // GET requests (verification) - skip validation
    if (req.method === 'GET') {
      return next();
    }

    // Check if body exists
    if (!req.body) {
      logger.warn('Empty webhook payload', { requestId });
      return res.status(200).json({ status: 'ignored', reason: 'empty_body' });
    }

    // Validate WhatsApp webhook structure
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    
    if (!value) {
      logger.warn('Invalid webhook structure - missing value', { 
        requestId,
        bodyPreview: JSON.stringify(req.body).substring(0, 100)
      });
      return res.status(200).json({ status: 'ignored', reason: 'invalid_structure' });
    }

    // Check for messages array
    if (!value.messages || !Array.isArray(value.messages) || value.messages.length === 0) {
      // Could be a status update - log and return 200
      if (value.statuses) {
        logger.debug('Status update received', { requestId });
      } else {
        logger.warn('No messages in webhook payload', { requestId });
      }
      return res.status(200).json({ status: 'ignored', reason: 'no_messages' });
    }

    // Validate first message
    const message = value.messages[0];
    
    if (!message.from) {
      logger.warn('Message missing sender phone number', { requestId });
      return res.status(200).json({ status: 'ignored', reason: 'missing_sender' });
    }

    if (message.type !== 'text' && message.type !== 'image' && message.type !== 'audio' && message.type !== 'location') {
      logger.warn('Unsupported message type received', { 
        requestId,
        messageType: message.type 
      });
      return res.status(200).json({ status: 'ignored', reason: 'unsupported_message_type' });
    }

    next();
  } catch (err) {
    logger.error('Webhook payload validation error', {
      error: err.message,
      requestId,
    });
    // Always return 200 to WhatsApp
    return res.status(200).json({ status: 'ignored', reason: 'validation_error' });
  }
}

/**
 * Sanitize and validate message content
 */
function validateAndSanitizeMessage(req, res, next) {
  const requestId = req.requestId || 'unknown';

  try {
    const message = req.body.entry[0].changes[0].value.messages[0];

    // Only sanitize and validate text if it's a text message
    if (message.type === 'text' && message.text) {
      let text = message.text.body || '';
      text = text.trim();

      // Check empty message
      if (text.length === 0) {
        logger.warn('Empty message after trimming', { requestId });
        return res.status(200).json({ status: 'ignored', reason: 'empty_message' });
      }

      // Check minimum length
      if (text.length < MIN_MESSAGE_LENGTH) {
        logger.warn('Message too short', { length: text.length, requestId });
        return res.status(200).json({ status: 'ignored', reason: 'message_too_short' });
      }

      // Check maximum length (spam protection)
      if (text.length > MAX_MESSAGE_LENGTH) {
        logger.warn('Message exceeds maximum length', { 
          length: text.length, 
          max: MAX_MESSAGE_LENGTH,
          requestId 
        });
        
        // Truncate message
        text = text.substring(0, MAX_MESSAGE_LENGTH);
      }

      // Strip HTML tags
      text = stripHTMLTags(text);

      // Strip injection patterns
      text = stripInjectionPatterns(text);

      // Normalize Unicode
      text = normalizeUnicode(text);

      // Update message with sanitized text
      message.text.body = text;
    } else if (message.type === 'image' && message.image) {
      if (message.image.caption) {
        let caption = message.image.caption.trim();
        caption = stripHTMLTags(caption);
        caption = stripInjectionPatterns(caption);
        caption = normalizeUnicode(caption);
        if (caption.length > MAX_MESSAGE_LENGTH) {
          caption = caption.substring(0, MAX_MESSAGE_LENGTH);
        }
        message.image.caption = caption;
      }
    }

    // Validate phone number
    const from = validatePhoneNumber(message.from);
    if (!from) {
      logger.warn('Invalid phone number format', { 
        original: message.from,
        requestId 
      });
      return res.status(200).json({ status: 'ignored', reason: 'invalid_phone' });
    }
    message.from = from;

    // Log sanitized message
    logger.debug('Message validated and sanitized', {
      type: message.type,
      from: from,
      requestId,
    });

    next();
  } catch (err) {
    logger.error('Message sanitization error', {
      error: err.message,
      requestId,
    });
    return res.status(200).json({ status: 'ignored', reason: 'sanitization_error' });
  }
}

/**
 * Strip HTML tags from text
 */
function stripHTMLTags(text) {
  // Remove HTML tags
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Strip potential injection patterns
 */
function stripInjectionPatterns(text) {
  // Remove SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/gi,
    /(--|;|\/\*|\*\/)/g,
  ];

  // Remove XSS patterns
  const xssPatterns = [
    /(<script|javascript:|on\w+=)/gi,
    /(alert\(|confirm\(|prompt\()/gi,
  ];

  let sanitized = text;

  // Remove SQL patterns
  sqlPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REMOVED]');
  });

  // Remove XSS patterns
  xssPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REMOVED]');
  });

  return sanitized;
}

/**
 * Normalize Unicode characters
 */
function normalizeUnicode(text) {
  return text.normalize('NFC');
}

/**
 * Validate and sanitize phone number
 */
function validatePhoneNumber(phone) {
  if (!phone) return null;

  // Strip non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Validate length (should be 10-15 digits for international)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }

  return cleaned;
}

/**
 * Combine all validation middleware
 */
function validateInput(req, res, next) {
  validateWebhookPayload(req, res, (err) => {
    if (err) return next(err);
    validateAndSanitizeMessage(req, res, next);
  });
}

module.exports = {
  validateInput,
  validateWebhookPayload,
  validateAndSanitizeMessage,
  stripHTMLTags,
  stripInjectionPatterns,
  normalizeUnicode,
  validatePhoneNumber,
};
