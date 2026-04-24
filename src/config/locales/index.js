// Locale Loader
// Load and manage locale files

const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

// Cache for loaded locales
const localeCache = new Map();

/**
 * Load locale file
 */
function loadLocale(language) {
  // Check cache
  if (localeCache.has(language)) {
    return localeCache.get(language);
  }

  try {
    const localePath = path.join(__dirname, '../config/locales', `${language}.json`);
    
    // Check if file exists
    if (!fs.existsSync(localePath)) {
      logger.warn(`Locale file not found: ${language}, falling back to English`);
      return loadFallbackLocale();
    }

    // Read and parse
    const localeData = fs.readFileSync(localePath, 'utf8');
    const parsed = JSON.parse(localeData);

    // Cache it
    localeCache.set(language, parsed);

    logger.debug(`Locale loaded: ${language}`);
    return parsed;

  } catch (error) {
    logger.error(`Failed to load locale ${language}`, {
      error: error.message,
    });
    return loadFallbackLocale();
  }
}

/**
 * Load fallback locale (English)
 */
function loadFallbackLocale() {
  if (!localeCache.has('en')) {
    try {
      const localePath = path.join(__dirname, '../config/locales', 'en.json');
      const localeData = fs.readFileSync(localePath, 'utf8');
      localeCache.set('en', JSON.parse(localeData));
    } catch (error) {
      logger.error('Failed to load English fallback locale', {
        error: error.message,
      });
      // Return empty object if even English fails
      return {};
    }
  }
  return localeCache.get('en');
}

/**
 * Get translated text
 */
function getTranslation(language, key, params = {}) {
  const locale = loadLocale(language);
  let text = locale[key] || loadFallbackLocale()[key] || key;

  // Replace parameters
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), value);
  }

  return text;
}

/**
 * Get all available languages
 */
function getAvailableLanguages() {
  try {
    const localesDir = path.join(__dirname, '../config/locales');
    const files = fs.readdirSync(localesDir);
    
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    logger.error('Failed to list available languages', {
      error: error.message,
    });
    return ['en'];
  }
}

/**
 * Clear locale cache (useful for development)
 */
function clearCache() {
  localeCache.clear();
  logger.info('Locale cache cleared');
}

module.exports = {
  loadLocale,
  getTranslation,
  getAvailableLanguages,
  clearCache,
};
