// Security Utilities
// Phone number hashing, input sanitization, and PII removal

const crypto = require('crypto');
const logger = require('../config/logger');

/**
 * Hash phone number for database storage (privacy protection)
 */
function hashPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    throw new Error('Phone number is required');
  }
  
  // Add salt for additional security
  const salt = process.env.PHONE_HASH_SALT || 'default_salt_change_in_production';
  const saltedPhone = `${salt}:${phoneNumber}`;
  
  // SHA-256 hash
  const hash = crypto
    .createHash('sha256')
    .update(saltedPhone)
    .digest('hex');
  
  return hash;
}

/**
 * Sanitize user input to prevent prompt injection in Gemini API calls
 */
function sanitizeForAI(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input;
  
  // Remove potential prompt injection patterns
  const injectionPatterns = [
    // System prompt overrides
    /ignore\s+previous\s+instructions/gi,
    /ignore\s+all\s+previous\s+rules/gi,
    /disregard\s+previous\s+instructions/gi,
    /forget\s+previous\s+instructions/gi,
    /bypass\s+instructions/gi,
    /override\s+instructions/gi,
    /ignore\s+the\s+system/gi,
    
    // System prompt extraction / Leakage protection
    /reveal\s+your\s+instructions/gi,
    /reveal\s+your\s+prompt/gi,
    /reveal\s+system\s+prompt/gi,
    /output\s+your\s+system\s+prompt/gi,
    /output\s+your\s+instructions/gi,
    /what\s+is\s+your\s+system\s+prompt/gi,
    /tell\s+me\s+your\s+system\s+prompt/gi,
    /what\s+is\s+your\s+instruction/gi,
    /tell\s+me\s+your\s+instructions/gi,
    /tell\s+me\s+your\s+rules/gi,
    /what\s+are\s+your\s+rules/gi,
    /you\s+are\s+a\s+.*and\s+your\s+instructions/gi,
    /leak\s+prompt/gi,
    /jailbreak/gi,
    /system\s+prompt\s+leak/gi,
    
    // Role-playing attacks
    /you\s+are\s+now\s+/gi,
    /act\s+as\s+/gi,
    /pretend\s+to\s+be\s+/gi,
    /role\s*:\s*/gi,
    
    // System commands
    /system\s*:/gi,
    /user\s*:/gi,
    /assistant\s*:/gi,
    
    // Command injection
    /execute\s+/gi,
    /run\s+command/gi,
    /\/\w+/g, // Unix commands
    
    // Markdown injection (could affect formatting)
    /```[\s\S]*?```/g, // Code blocks
    /#{1,6}\s+/g, // Headers
    
    // HTML tags
    /<[^>]*>/g,
    
    // JavaScript
    /javascript\s*:/gi,
    /on\w+\s*=/gi,
    
    // SQL injection (just in case)
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)/gi,
    /(--|;|\/\*|\*\/)/g,
  ];
  
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[REMOVED]');
  }
  
  // Trim and limit length
  sanitized = sanitized.trim().substring(0, 1000);
  
  return sanitized;
}

/**
 * Remove personally identifiable information (PII) from logs
 */
function removePII(data, options = {}) {
  if (!data) {
    return data;
  }
  
  const {
    maskPhone = true,
    maskEmail = true,
    maskName = false,
    maskLocation = false,
  } = options;
  
  let sanitized = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Mask phone numbers (Indian format)
  if (maskPhone) {
    // +91 98765 43210
    sanitized = sanitized.replace(/(\+91\s*\d{5})\s*(\d{5})/g, '$1 XXXXX');
    // 9876543210
    sanitized = sanitized.replace(/(\d{5})\d{5}/g, '$1XXXXX');
  }
  
  // Mask email addresses
  if (maskEmail) {
    sanitized = sanitized.replace(
      /([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
      '$1@***.***'
    );
  }
  
  // Mask names (if provided in options)
  if (maskName && options.names) {
    for (const name of options.names) {
      const regex = new RegExp(name, 'gi');
      sanitized = sanitized.replace(regex, '[NAME REDACTED]');
    }
  }
  
  // Mask specific locations (if provided)
  if (maskLocation && options.locations) {
    for (const location of options.locations) {
      const regex = new RegExp(`\\b${location}\\b`, 'gi');
      sanitized = sanitized.replace(regex, '[LOCATION]');
    }
  }
  
  return sanitized;
}

/**
 * Create a safe log object (no sensitive data)
 */
function createSafeLogObject(data) {
  if (!data) {
    return {};
  }
  
  const safeData = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = [
    'token',
    'accessToken',
    'refreshToken',
    'password',
    'secret',
    'apiKey',
    'api_key',
    'phone',
    'phoneNumber',
    'email',
    'name',
    'address',
  ];
  
  for (const field of sensitiveFields) {
    if (safeData[field]) {
      if (field === 'phone' || field === 'phoneNumber') {
        safeData[field] = removePII(safeData[field], { maskPhone: true });
      } else if (field === 'email') {
        safeData[field] = removePII(safeData[field], { maskEmail: true });
      } else {
        delete safeData[field];
      }
    }
  }
  
  // Truncate long strings
  for (const [key, value] of Object.entries(safeData)) {
    if (typeof value === 'string' && value.length > 200) {
      safeData[key] = value.substring(0, 200) + '...';
    }
  }
  
  return safeData;
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone) {
  if (!phone) return false;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Check if it's a valid phone number (10-15 digits)
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Format phone number to standard format
 */
function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Add country code if missing
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  
  return digits;
}

/**
 * Generate secure random token
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Compare two strings securely (timing-safe)
 */
function secureCompare(a, b) {
  if (!a || !b) return false;
  
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  if (bufA.length !== bufB.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  hashPhoneNumber,
  sanitizeForAI,
  removePII,
  createSafeLogObject,
  isValidPhoneNumber,
  formatPhoneNumber,
  generateSecureToken,
  generateCSRFToken,
  secureCompare,
};
