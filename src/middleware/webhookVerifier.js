// Webhook Verifier Middleware
// Verify WhatsApp webhook signature using X-Hub-Signature-256 header

const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * Verify WhatsApp webhook signature
 * 
 * WhatsApp sends X-Hub-Signature-256 header with HMAC-SHA256 signature
 * We verify it matches our app secret
 */
function verifyWebhookSignature(req, res, next) {
  try {
    // Get signature from header
    const signature = req.headers['x-hub-signature-256'];
    
    // Skip verification for GET requests (webhook verification challenge)
    if (req.method === 'GET') {
      return next();
    }
    
    // If no signature header, reject
    if (!signature) {
      logger.warn('⚠️ Webhook request missing signature header', {
        ip: req.ip,
        method: req.method,
        path: req.path,
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing webhook signature',
      });
    }
    
    // Get app secret from environment
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    
    if (!appSecret) {
      logger.error('❌ WHATSAPP_APP_SECRET not configured');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Webhook verification not configured',
      });
    }
    
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    
    // Calculate expected signature
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
    
    // Compare signatures
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
    if (!isValid) {
      logger.warn('🚫 Invalid webhook signature', {
        ip: req.ip,
        signature: signature?.substring(0, 20) + '...',
        expected: expectedSignature?.substring(0, 20) + '...',
      });
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
    }
    
    // Signature valid, proceed
    logger.debug('✅ Webhook signature verified');
    next();
    
  } catch (error) {
    logger.error('Webhook verification error', {
      error: error.message,
      stack: error.stack,
    });
    
    // On error, reject the request (fail-closed for security)
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Webhook verification failed',
    });
  }
}

/**
 * Verify webhook verification token (for initial setup)
 * Used when Facebook/WhatsApp verifies your webhook URL
 */
function verifyWebhookToken(req, res, next) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // This is a webhook verification request
  if (mode === 'subscribe' && token) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    
    if (!verifyToken) {
      logger.error('❌ WHATSAPP_VERIFY_TOKEN not configured');
      return res.status(403).send('Forbidden');
    }
    
    if (token === verifyToken) {
      logger.info('✅ Webhook verification successful');
      return res.status(200).send(challenge);
    } else {
      logger.warn('🚫 Webhook verification token mismatch');
      return res.status(403).send('Forbidden');
    }
  }
  
  // Not a verification request, continue
  next();
}

module.exports = {
  verifyWebhookSignature,
  verifyWebhookToken,
};
