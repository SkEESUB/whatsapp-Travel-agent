// Environment Configuration Validator
// Validate ALL required environment variables on startup

const logger = require('../config/logger');

// Required environment variables
const REQUIRED_ENV_VARS = {
  // WhatsApp Configuration
  WHATSAPP_ACCESS_TOKEN: {
    description: 'WhatsApp Business API access token',
    validate: (value) => typeof value === 'string' && value.length > 10,
    example: 'EAAxxxxx...',
  },
  
  WHATSAPP_VERIFY_TOKEN: {
    description: 'Webhook verification token (you choose this)',
    validate: (value) => typeof value === 'string' && value.length >= 6,
    example: 'my_verify_token_123',
  },
  
  WHATSAPP_PHONE_NUMBER_ID: {
    description: 'WhatsApp Business phone number ID',
    validate: (value) => typeof value === 'string' && /^\d+$/.test(value),
    example: '123456789012345',
  },
  
  WHATSAPP_APP_SECRET: {
    description: 'WhatsApp app secret for webhook signature verification',
    validate: (value) => typeof value === 'string' && value.length > 10,
    example: 'a1b2c3d4e5f6...',
  },
  
  // AI Configuration
  GEMINI_API_KEY: {
    description: 'Google Gemini AI API key',
    validate: (value) => typeof value === 'string' && value.length > 20,
    example: 'AIzaSyA...',
  },
  
  // Database Configuration
  REDIS_URL: {
    description: 'Redis connection URL',
    validate: (value) => {
      if (!value) return false;
      // Accept both URL format and individual host/port
      return value.startsWith('redis://') || 
             value.startsWith('rediss://') ||
             (process.env.REDIS_HOST && process.env.REDIS_PORT);
    },
    example: 'redis://localhost:6379',
  },
  
  MONGODB_URI: {
    description: 'MongoDB connection string',
    validate: (value) => {
      if (!value) return false;
      // Accept MongoDB URI format
      return value.startsWith('mongodb://') || value.startsWith('mongodb+srv://');
    },
    example: 'mongodb://localhost:27017/travelbot',
  },
  
  // Server Configuration
  NODE_ENV: {
    description: 'Node environment (development, production, test)',
    validate: (value) => ['development', 'production', 'test'].includes(value),
    example: 'production',
  },
  
  PORT: {
    description: 'Server port number',
    validate: (value) => {
      const port = parseInt(value);
      return port > 0 && port < 65536;
    },
    example: '3000',
  },
};

/**
 * Validate all required environment variables
 */
function validateEnvironment() {
  const missing = [];
  const invalid = [];
  
  logger.info('🔍 Validating environment variables...');
  
  for (const [varName, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[varName];
    
    // Check if variable exists
    if (!value) {
      missing.push({
        name: varName,
        description: config.description,
        example: config.example,
      });
      continue;
    }
    
    // Validate format
    if (!config.validate(value)) {
      invalid.push({
        name: varName,
        description: config.description,
        value: maskValue(value),
        example: config.example,
      });
    }
  }
  
  // Report missing variables
  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:', {
      count: missing.length,
      variables: missing.map(v => v.name),
    });
    
    console.log('\n❌ MISSING ENVIRONMENT VARIABLES:');
    console.log('='.repeat(60));
    missing.forEach((v, i) => {
      console.log(`${i + 1}. ${v.name}`);
      console.log(`   Description: ${v.description}`);
      console.log(`   Example: ${v.example}`);
      console.log('');
    });
  }
  
  // Report invalid variables
  if (invalid.length > 0) {
    logger.error('❌ Invalid environment variables:', {
      count: invalid.length,
      variables: invalid.map(v => v.name),
    });
    
    console.log('\n❌ INVALID ENVIRONMENT VARIABLES:');
    console.log('='.repeat(60));
    invalid.forEach((v, i) => {
      console.log(`${i + 1}. ${v.name}`);
      console.log(`   Description: ${v.description}`);
      console.log(`   Current value: ${v.value}`);
      console.log(`   Expected format: ${v.example}`);
      console.log('');
    });
  }
  
  // Exit if any issues
  if (missing.length > 0 || invalid.length > 0) {
    logger.error('❌ Environment validation failed. Server cannot start.');
    console.log('💡 Fix these issues in your .env file and restart the server.');
    console.log('');
    
    // Exit with error code
    process.exit(1);
  }
  
  // All valid
  logger.info('✅ All environment variables validated successfully');
  console.log('✅ Environment validation passed');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   PORT: ${process.env.PORT}`);
  console.log(`   GEMINI_API_KEY: ${maskValue(process.env.GEMINI_API_KEY)}`);
  console.log(`   WHATSAPP_ACCESS_TOKEN: ${maskValue(process.env.WHATSAPP_ACCESS_TOKEN)}`);
  console.log(`   REDIS_URL: ${maskValue(process.env.REDIS_URL)}`);
  console.log(`   MONGODB_URI: ${maskValue(process.env.MONGODB_URI)}`);
  console.log('');
  
  return true;
}

/**
 * Mask sensitive values for logging
 */
function maskValue(value) {
  if (!value || value.length <= 8) {
    return '****';
  }
  
  // Show first 4 and last 4 characters
  return value.substring(0, 4) + '...' + value.substring(value.length - 4);
}

/**
 * Get environment info (safe for logging)
 */
function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasWhatsAppToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
    hasRedisUrl: !!process.env.REDIS_URL,
    hasMongoDBUri: !!process.env.MONGODB_URI,
  };
}

/**
 * Sanitize environment variable value for display
 */
function getSafeEnvValue(varName) {
  const value = process.env[varName];
  
  if (!value) {
    return null;
  }
  
  // Never return actual sensitive values
  if (varName.includes('TOKEN') || 
      varName.includes('KEY') || 
      varName.includes('SECRET') ||
      varName.includes('PASSWORD')) {
    return maskValue(value);
  }
  
  return value;
}

module.exports = {
  validateEnvironment,
  getEnvironmentInfo,
  getSafeEnvValue,
  REQUIRED_ENV_VARS,
};
