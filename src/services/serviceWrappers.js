// Service Wrapper - Pre-configured error wrappers for all travel services
// Import this file to get wrapped versions of all service functions
// Every function automatically returns fallback messages on error

const { tryCatchWrapperStructured } = require('../utils/asyncWrapper');

// ===== TRANSPORT SERVICE WRAPPERS =====
const transportService = require('../services/transportService');

const getBusOptionsSafe = tryCatchWrapperStructured(
  transportService.getBusOptions,
  '⚠️ Bus information temporarily unavailable. Please try again later.'
);

const getTrainOptionsSafe = tryCatchWrapperStructured(
  transportService.getTrainOptions,
  '⚠️ Train information temporarily unavailable. Please try again later.'
);

const getFlightOptionsSafe = tryCatchWrapperStructured(
  transportService.getFlightOptions,
  '⚠️ Flight information temporarily unavailable. Please try again later.'
);

// ===== HOTEL SERVICE WRAPPERS =====
const hotelService = require('../services/hotelService');

const getHotelsSafe = tryCatchWrapperStructured(
  hotelService.getHotels,
  '⚠️ Hotel information temporarily unavailable. Please try again later.'
);

// ===== ITINERARY SERVICE WRAPPERS =====
const itineraryService = require('../services/itineraryService');

const getItinerarySafe = tryCatchWrapperStructured(
  itineraryService.getItinerary,
  '⚠️ Itinerary generation failed. Please try again later.'
);

// ===== BUDGET SERVICE WRAPPERS =====
const budgetService = require('../services/budgetService');

const getBudgetPlanSafe = tryCatchWrapperStructured(
  budgetService.getBudgetPlan,
  '⚠️ Budget information temporarily unavailable. Please try again later.'
);

// ===== WEATHER SERVICE WRAPPERS =====
const weatherService = require('../services/weatherService');

const getWeatherSafe = tryCatchWrapperStructured(
  weatherService.getWeather,
  '⚠️ Weather data not available. Please try again later.'
);

// ===== GEMINI SERVICE WRAPPERS =====
const geminiService = require('../services/geminiService');

const generateAIResponseSafe = tryCatchWrapperStructured(
  geminiService.generateAIResponse,
  '⚠️ AI service temporarily unavailable. Please try again.'
);

const getTransportOptionsSafe = tryCatchWrapperStructured(
  geminiService.getTransportOptions,
  '⚠️ Transport information temporarily unavailable. Please try again.'
);

const getHotelRecommendationsSafe = tryCatchWrapperStructured(
  geminiService.getHotelRecommendations,
  '⚠️ Hotel information temporarily unavailable. Please try again.'
);

const getTouristPlacesSafe = tryCatchWrapperStructured(
  geminiService.getTouristPlaces,
  '⚠️ Tourist places information temporarily unavailable. Please try again.'
);

const getItineraryGeminiSafe = tryCatchWrapperStructured(
  geminiService.getItinerary,
  '⚠️ Itinerary information temporarily unavailable. Please try again.'
);

const getBudgetPlanGeminiSafe = tryCatchWrapperStructured(
  geminiService.getBudgetPlan,
  '⚠️ Budget information temporarily unavailable. Please try again.'
);

// Export all wrapped services
module.exports = {
  // Transport
  getBusOptionsSafe,
  getTrainOptionsSafe,
  getFlightOptionsSafe,
  
  // Hotels
  getHotelsSafe,
  
  // Itinerary
  getItinerarySafe,
  
  // Budget
  getBudgetPlanSafe,
  
  // Weather
  getWeatherSafe,
  
  // Gemini
  generateAIResponseSafe,
  getTransportOptionsSafe,
  getHotelRecommendationsSafe,
  getTouristPlacesSafe,
  getItineraryGeminiSafe,
  getBudgetPlanGeminiSafe,
  
  // Original services (if needed for manual error handling)
  transportService,
  hotelService,
  itineraryService,
  budgetService,
  weatherService,
  geminiService,
};
