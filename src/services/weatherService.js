// Weather Service - Fetch real-time weather data using Open-Meteo API
// No API key required for Open-Meteo

const axios = require('axios');

/**
 * Get weather code description
 * @param {number} code - WMO weather code
 * @returns {string} - Weather condition text
 */
function getWeatherDescription(code) {
  const weatherCodes = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };

  return weatherCodes[code] || 'Unknown';
}

/**
 * Get weather for a city
 * @param {string} cityName - Name of the city
 * @returns {Promise<object|null>} - Weather data or null
 */
async function getWeather(cityName) {
  try {
    console.log(`🌦 [Weather] Fetching weather for ${cityName}`);

    // Step 1: Geocode city name to get coordinates
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
    
    const geocodeResponse = await axios.get(geocodeUrl);
    
    if (!geocodeResponse.data?.results?.[0]) {
      console.warn(`⚠️ [Weather] City not found: ${cityName}`);
      return null;
    }

    const location = geocodeResponse.data.results[0];
    const latitude = location.latitude;
    const longitude = location.longitude;

    console.log(`📍 [Weather] Coordinates: ${latitude}, ${longitude}`);

    // Step 2: Fetch weather data using coordinates
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    
    const weatherResponse = await axios.get(weatherUrl);
    
    if (!weatherResponse.data?.current_weather) {
      console.warn(`⚠️ [Weather] No weather data available`);
      return null;
    }

    const currentWeather = weatherResponse.data.current_weather;
    const temperature = currentWeather.temperature;
    const weatherCode = currentWeather.weathercode;
    const windSpeed = currentWeather.windspeed;
    
    const condition = getWeatherDescription(weatherCode);

    console.log(`✅ [Weather] Retrieved: ${temperature}°C, ${condition}`);

    return {
      temperature,
      condition,
      weatherCode,
      windSpeed,
      city: cityName,
    };

  } catch (error) {
    console.error('❌ [Weather] Error:', error.message);
    return null;
  }
}

module.exports = {
  getWeather,
};
