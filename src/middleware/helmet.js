// Helmet Security Middleware
// HTTP security headers, CORS, and other security configurations

const helmet = require('helmet');
const cors = require('cors');
const logger = require('../config/logger');

/**
 * Configure Helmet security headers
 */
function configureHelmet() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://graph.facebook.com'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    
    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    
    // Prevent clickjacking
    frameguard: {
      action: 'deny',
    },
    
    // Prevent MIME type sniffing
    noSniff: true,
    
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    
    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false,
    },
    
    // IE XSS Filter
    ieNoOpen: true,
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
  });
}

/**
 * Configure CORS (Cross-Origin Resource Sharing)
 * Only allow WhatsApp webhook origins
 */
function configureCORS() {
  // Allowed origins for WhatsApp webhook
  const allowedOrigins = [
    'https://graph.facebook.com',
    'https://graph.whatsapp.com',
    process.env.WHATSAPP_WEBHOOK_URL || 'https://graph.facebook.com',
  ].filter(Boolean);
  
  return cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Block other origins
      logger.warn('🚫 CORS blocked request from unauthorized origin', {
        origin,
      });
      
      return callback(new Error('Not allowed by CORS'));
    },
    
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256'],
    exposedHeaders: ['X-Request-ID'],
    credentials: false,
    maxAge: 86400, // 24 hours
  });
}

/**
 * Remove X-Powered-By header (Express default)
 */
function disableXPowereBy(app) {
  app.disable('x-powered-by');
  
  // Double-check with middleware
  app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    next();
  });
}

/**
 * Additional security headers
 */
function securityHeaders() {
  return (req, res, next) => {
    // Prevent caching of sensitive data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    
    // Remove server header
    res.removeHeader('server');
    
    next();
  };
}

/**
 * Apply all security middleware
 */
function applySecurityMiddleware(app) {
  // Disable X-Powered-By
  disableXPowereBy(app);
  
  // Apply Helmet
  app.use(configureHelmet());
  
  // Apply CORS
  app.use(configureCORS());
  
  // Apply additional security headers
  app.use(securityHeaders());
  
  logger.info('🔒 Security middleware configured');
  logger.info('   - Helmet security headers enabled');
  logger.info('   - CORS configured for WhatsApp origins');
  logger.info('   - X-Powered-By disabled');
  logger.info('   - Cache control headers set');
}

module.exports = {
  configureHelmet,
  configureCORS,
  disableXPowereBy,
  securityHeaders,
  applySecurityMiddleware,
};
