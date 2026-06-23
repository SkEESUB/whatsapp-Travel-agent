// Link Shortener Utility
// Shorten long tracking or affiliate links using Redis for redirection tracking

const crypto = require('crypto');
const redis = require('../config/redis');
const logger = require('../config/logger');

// Base URL for short links
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

/**
 * Generate a random 6-character short code
 */
function generateCode() {
  return crypto.randomBytes(3).toString('hex');
}

/**
 * Shorten a long URL and store in Redis
 * 
 * @param {string} longUrl - The original URL
 * @param {Object} metadata - Optional metadata (userPhoneHash, platform, linkType, destination)
 * @param {number} ttl - TTL in seconds (default: 30 days = 2592000s)
 * @returns {Promise<string>} The shortened URL
 */
async function shorten(longUrl, metadata = {}, ttl = 2592000) {
  try {
    const code = generateCode();
    const key = `short:${code}`;
    
    const value = {
      longUrl,
      metadata,
    };
    
    // Store as JSON string in Redis
    await redis.executeCommand('set', key, JSON.stringify(value), 'EX', ttl);
    
    logger.debug('URL shortened successfully', { code, longUrl });
    return `${API_BASE_URL}/l/${code}`;
  } catch (error) {
    logger.error('Failed to shorten URL', { error: error.message, longUrl });
    throw error;
  }
}

/**
 * Retrieve the original URL and metadata from code
 * 
 * @param {string} code - The short code
 * @returns {Promise<Object|null>} Object containing longUrl and metadata, or null if not found
 */
async function getUrl(code) {
  try {
    const key = `short:${code}`;
    const value = await redis.executeCommand('get', key);
    
    if (!value) {
      return null;
    }
    
    return JSON.parse(value);
  } catch (error) {
    logger.error('Failed to retrieve shortened URL', { error: error.message, code });
    return null;
  }
}

module.exports = {
  shorten,
  getUrl,
};
