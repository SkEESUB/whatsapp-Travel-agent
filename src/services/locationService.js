// Location Service - WhatsApp Location Message Processing
// Reverse geocodes coordinates to city name for trip planning

const axios = require('axios');
const cacheManager = require('../cache/cacheManager');
const logger = require('../config/logger');

// Configuration
const GOOGLE_CONFIG = {
  apiKey: process.env.GOOGLE_MAPS_API_KEY,
  baseUrl: 'https://maps.googleapis.com/maps/api',
};

const OPENWEATHER_CONFIG = {
  apiKey: process.env.OPENWEATHER_API_KEY,
  baseUrl: 'https://api.openweathermap.org',
};

/**
 * Reverse geocode coordinates to city name using Google Maps API
 */
async function reverseGeocodeWithGoogle(lat, lng) {
  try {
    if (!GOOGLE_CONFIG.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    logger.info('Reverse geocoding with Google Maps', { lat, lng });

    const response = await axios.get(
      `${GOOGLE_CONFIG.baseUrl}/geocode/json`,
      {
        params: {
          latlng: `${lat},${lng}`,
          key: GOOGLE_CONFIG.apiKey,
          result_type: 'locality|administrative_area_level_1|country',
        },
        timeout: 10000,
      }
    );

    const results = response.data.results;

    if (!results || results.length === 0) {
      throw new Error('No address found for coordinates');
    }

    // Extract city/locality name
    let city = null;
    let state = null;
    let country = null;

    for (const result of results) {
      for (const component of result.address_components) {
        if (component.types.includes('locality') && !city) {
          city = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1') && !state) {
          state = component.long_name;
        }
        if (component.types.includes('country') && !country) {
          country = component.long_name;
        }
      }
    }

    const locationName = city || state || country;

    if (!locationName) {
      throw new Error('Could not determine location name');
    }

    logger.info('Reverse geocoding successful (Google)', {
      lat,
      lng,
      city,
      state,
      country,
      locationName,
    });

    return {
      success: true,
      city: locationName,
      state,
      country,
      formatted: city ? `${city}, ${state || ''}` : locationName,
    };

  } catch (error) {
    logger.error('Google reverse geocoding failed', {
      error: error.message,
      lat,
      lng,
    });
    throw error;
  }
}

/**
 * Reverse geocode using OpenWeatherMap (fallback, free)
 */
async function reverseGeocodeWithOpenWeather(lat, lng) {
  try {
    if (!OPENWEATHER_CONFIG.apiKey) {
      throw new Error('OpenWeather API key not configured');
    }

    logger.info('Reverse geocoding with OpenWeather', { lat, lng });

    const response = await axios.get(
      `${OPENWEATHER_CONFIG.baseUrl}/geo/1.0/reverse`,
      {
        params: {
          lat,
          lon: lng,
          limit: 1,
          appid: OPENWEATHER_CONFIG.apiKey,
        },
        timeout: 10000,
      }
    );

    const results = response.data;

    if (!results || results.length === 0) {
      throw new Error('No location found for coordinates');
    }

    const location = results[0];
    const city = location.name;
    const state = location.state;
    const country = location.country;

    logger.info('Reverse geocoding successful (OpenWeather)', {
      lat,
      lng,
      city,
      state,
      country,
    });

    return {
      success: true,
      city,
      state,
      country,
      formatted: city ? `${city}, ${state || ''}` : city,
    };

  } catch (error) {
    logger.error('OpenWeather reverse geocoding failed', {
      error: error.message,
      lat,
      lng,
    });
    throw error;
  }
}

/**
 * Reverse geocode (tries Google first, falls back to OpenWeather)
 */
async function reverseGeocode(lat, lng) {
  try {
    const roundedLat = Number(lat).toFixed(4);
    const roundedLng = Number(lng).toFixed(4);
    const cacheKey = `geocode:${roundedLat}:${roundedLng}`;

    // Try cache first
    const cachedResult = await cacheManager.getFromCache(cacheKey);
    if (cachedResult) {
      logger.info('✅ Geocoding cache hit', { lat, lng, city: cachedResult.city });
      return cachedResult;
    }

    // Cache miss - call APIs
    const result = await (async () => {
      try {
        return await reverseGeocodeWithGoogle(lat, lng);
      } catch (googleError) {
        logger.warn('Google geocoding failed, trying OpenWeather', {
          error: googleError.message,
        });
        return await reverseGeocodeWithOpenWeather(lat, lng);
      }
    })();

    if (result && result.success) {
      // Cache coordinates for 30 days (city locations are static)
      await cacheManager.setCache(cacheKey, result, 30 * 24 * 60 * 60);
    }

    return result;

  } catch (error) {
    logger.error('All geocoding services failed', {
      error: error.message,
    });

    // Return coordinates as fallback
    return {
      success: false,
      city: `Location (${Number(lat).toFixed(2)}, ${Number(lng).toFixed(2)})`,
      state: null,
      country: null,
      formatted: `Coordinates: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
    };
  }
}

/**
 * Process location message from WhatsApp
 * Reverse geocodes and returns city name
 */
async function processLocationMessage(phoneNumber, lat, lng) {
  try {
    logger.info('Processing location message', {
      phoneNumber,
      lat,
      lng,
    });

    // Step 1: Reverse geocode
    const location = await reverseGeocode(lat, lng);

    logger.info('Location message processed successfully', {
      phoneNumber,
      location: location.formatted,
    });

    return {
      success: true,
      city: location.city,
      state: location.state,
      country: location.country,
      formatted: location.formatted,
      lat,
      lng,
    };

  } catch (error) {
    logger.error('Location message processing failed', {
      error: error.message,
      phoneNumber,
      lat,
      lng,
    });

    return {
      success: false,
      error: error.message,
      city: null,
      formatted: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  }
}

/**
 * Format location response
 */
function formatLocationResponse(location) {
  return `📍 *Got it! You're in ${location.formatted}.*\n\nWhere do you want to travel? Send me a destination name! 🌍`;
}

/**
 * Generate location error message
 */
function getLocationErrorMessage(error) {
  return `⚠️ *Sorry, I couldn't identify your location.*\n\nPlease send your location again or type the city name manually.\n\nError: ${error}`;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

module.exports = {
  reverseGeocode,
  processLocationMessage,
  formatLocationResponse,
  getLocationErrorMessage,
  calculateDistance,
};
