// Example: How to use logger in travelEngine.js
// This shows the BEFORE (console.log) and AFTER (logger) patterns

const logger = require('../config/logger');
const { apiCallWrapper, logGeminiCall, logWeatherCall } = require('../utils/apiLogger');
const transportService = require("../services/transportService");
const hotelService = require("../services/hotelService");
const itineraryService = require("../services/itineraryService");
const budgetService = require("../services/budgetService");
const distanceRules = require("../utils/distanceRules");
const weatherService = require("../services/weatherService");
const geminiService = require("../services/geminiService");

class TravelEngine {
  
  // ===== BEFORE (Old Way - console.log) =====
  /*
  async getTransport(origin, destination, mode, budget, people) {
    try {
      console.log(`🚀 Getting ${mode} options: ${origin} → ${destination}`);
      
      const result = await transportService.getBusOptions(origin, destination, budget, people);
      
      if (!result) {
        return { success: false, message: "⚠️ Travel information unavailable" };
      }
      
      return { success: true, data: result };
    } catch (err) {
      console.error("❌ Travel Engine error:", err.message);
      return { success: false, message: "⚠️ Travel information unavailable" };
    }
  }
  */

  // ===== AFTER (New Way - logger) =====
  async getTransport(origin, destination, mode, budget, people, requestId = null) {
    const startTime = Date.now();

    try {
      logger.serviceCall({
        serviceName: 'TravelEngine',
        action: 'getTransport',
        params: { origin, destination, mode, budget, people },
        requestId,
      });

      // Check if requested mode is available for this route
      const distanceInfo = distanceRules.getRecommendedTransport(origin, destination);
      
      if (distanceInfo.unavailable.includes(mode.toLowerCase())) {
        logger.warn('Transport mode unavailable for route', {
          origin,
          destination,
          mode,
          reason: distanceInfo.message,
          requestId,
        });
        
        return {
          success: false,
          message: distanceInfo.message || `✈️ ${mode} is not available for this route.`
        };
      }

      let result;
      switch (mode.toLowerCase()) {
        case 'bus':
          result = await transportService.getBusOptions(origin, destination, budget, people);
          break;
        case 'train':
          result = await transportService.getTrainOptions(origin, destination, budget, people);
          break;
        case 'flight':
          result = await transportService.getFlightOptions(origin, destination, budget, people);
          break;
        default:
          result = null;
      }

      const duration = Date.now() - startTime;

      if (!result) {
        logger.error('Transport service returned null', {
          origin,
          destination,
          mode,
          duration: `${duration}ms`,
          requestId,
        });
        
        return {
          success: false,
          message: "⚠️ Travel information temporarily unavailable. Please try again later."
        };
      }

      logger.info('Transport options retrieved successfully', {
        origin,
        destination,
        mode,
        duration: `${duration}ms`,
        recommended: distanceInfo.preferred,
        requestId,
      });

      return {
        success: true,
        data: result,
        recommended: distanceInfo.preferred
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      
      logger.error('Travel Engine transport error', {
        origin,
        destination,
        mode,
        error: err.message,
        stack: err.stack,
        duration: `${duration}ms`,
        requestId,
      });

      return {
        success: false,
        message: "⚠️ Travel information temporarily unavailable. Please try again later."
      };
    }
  }

  // Get hotel recommendations
  async getHotels(destination, budget, days, requestId = null) {
    const startTime = Date.now();

    try {
      logger.serviceCall({
        serviceName: 'TravelEngine',
        action: 'getHotels',
        params: { destination, budget, days },
        requestId,
      });

      const result = await hotelService.getHotels(destination, budget, days);
      const duration = Date.now() - startTime;

      if (!result) {
        logger.error('Hotel service returned null', {
          destination,
          budget,
          days,
          duration: `${duration}ms`,
          requestId,
        });

        return {
          success: false,
          message: "⚠️ Hotel information temporarily unavailable. Please try again later."
        };
      }

      logger.info('Hotel options retrieved successfully', {
        destination,
        budget,
        days,
        duration: `${duration}ms`,
        requestId,
      });

      return { success: true, data: result };

    } catch (err) {
      const duration = Date.now() - startTime;
      
      logger.error('Travel Engine hotel error', {
        destination,
        error: err.message,
        stack: err.stack,
        duration: `${duration}ms`,
        requestId,
      });

      return {
        success: false,
        message: "⚠️ Hotel information temporarily unavailable. Please try again later."
      };
    }
  }

  // Get weather
  async getWeather(destination, requestId = null) {
    const startTime = Date.now();

    try {
      logger.serviceCall({
        serviceName: 'TravelEngine',
        action: 'getWeather',
        params: { destination },
        requestId,
      });

      const result = await weatherService.getWeather(destination);
      const duration = Date.now() - startTime;

      if (!result) {
        logWeatherCall(destination, false, null, new Error('No weather data'), requestId);
        
        return {
          success: false,
          message: "⚠️ Weather data not available",
        };
      }

      // Log weather API call
      logWeatherCall(destination, true, result, null, requestId);

      // Format weather data for WhatsApp
      const weatherMessage = `🌦 *WEATHER* — ${result.city}\n\n` +
        `🌡️ Temperature: ${result.temperature}°C\n` +
        `☁️ Condition: ${result.condition}\n` +
        `💨 Wind Speed: ${result.windSpeed} km/h`;

      logger.info('Weather data retrieved successfully', {
        destination,
        temperature: result.temperature,
        condition: result.condition,
        duration: `${duration}ms`,
        requestId,
      });

      return {
        success: true,
        data: weatherMessage,
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      
      logWeatherCall(destination, false, null, err, requestId);

      logger.error('Travel Engine weather error', {
        destination,
        error: err.message,
        stack: err.stack,
        duration: `${duration}ms`,
        requestId,
      });

      return {
        success: false,
        message: "⚠️ Weather service unavailable",
      };
    }
  }

  // Get food guide
  async getFoodGuide(destination, requestId = null) {
    const startTime = Date.now();

    try {
      logger.serviceCall({
        serviceName: 'TravelEngine',
        action: 'getFoodGuide',
        params: { destination },
        requestId,
      });

      const prompt = `Generate a clean and structured food guide for ${destination}, India...`;

      // Wrap Gemini call with logging
      const response = await apiCallWrapper(
        'Gemini',
        async () => {
          return await geminiService.generateAIResponse(prompt);
        },
        { requestId }
      );

      const duration = Date.now() - startTime;

      if (!response) {
        logGeminiCall('gemini-2.5-flash', prompt.length, false, duration, new Error('No response'), requestId);

        // Fallback food guide
        return {
          success: true,
          data: `🍛 *FOOD GUIDE* — ${destination}\n\n...`,
        };
      }

      logGeminiCall('gemini-2.5-flash', prompt.length, true, duration, null, requestId);

      logger.info('Food guide generated successfully', {
        destination,
        responseLength: response.length,
        duration: `${duration}ms`,
        requestId,
      });

      return {
        success: true,
        data: response,
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      
      logGeminiCall('gemini-2.5-flash', 0, false, duration, err, requestId);

      logger.error('Travel Engine food guide error', {
        destination,
        error: err.message,
        stack: err.stack,
        duration: `${duration}ms`,
        requestId,
      });

      return {
        success: false,
        message: "⚠️ Food guide unavailable",
      };
    }
  }

  // Get itinerary
  async getItinerary(destination, days, people, budget, requestId = null) {
    const startTime = Date.now();

    try {
      logger.serviceCall({
        serviceName: 'TravelEngine',
        action: 'getItinerary',
        params: { destination, days, people, budget },
        requestId,
      });

      const result = await itineraryService.getItinerary(destination, days, people, budget);
      const duration = Date.now() - startTime;

      if (!result) {
        logger.error('Itinerary service returned null', {
          destination,
          days,
          duration: `${duration}ms`,
          requestId,
        });

        return {
          success: false,
          message: "⚠️ Itinerary information temporarily unavailable. Please try again later."
        };
      }

      logger.info('Itinerary generated successfully', {
        destination,
        days,
        people,
        duration: `${duration}ms`,
        requestId,
      });

      return { success: true, data: result };

    } catch (err) {
      const duration = Date.now() - startTime;
      
      logger.error('Travel Engine itinerary error', {
        destination,
        days,
        error: err.message,
        stack: err.stack,
        duration: `${duration}ms`,
        requestId,
      });

      return {
        success: false,
        message: "⚠️ Itinerary information temporarily unavailable. Please try again later."
      };
    }
  }

  // Get budget breakdown
  async getBudget(destination, totalBudget, people, days, requestId = null) {
    const startTime = Date.now();

    try {
      logger.serviceCall({
        serviceName: 'TravelEngine',
        action: 'getBudget',
        params: { destination, totalBudget, people, days },
        requestId,
      });

      const result = await budgetService.getBudgetPlan(destination, totalBudget, people, days);
      const duration = Date.now() - startTime;

      if (!result) {
        logger.error('Budget service returned null', {
          destination,
          totalBudget,
          duration: `${duration}ms`,
          requestId,
        });

        return {
          success: false,
          message: "⚠️ Budget information temporarily unavailable. Please try again later."
        };
      }

      logger.info('Budget plan generated successfully', {
        destination,
        totalBudget,
        people,
        duration: `${duration}ms`,
        requestId,
      });

      return { success: true, data: result };

    } catch (err) {
      const duration = Date.now() - startTime;
      
      logger.error('Travel Engine budget error', {
        destination,
        totalBudget,
        error: err.message,
        stack: err.stack,
        duration: `${duration}ms`,
        requestId,
      });

      return {
        success: false,
        message: "⚠️ Budget information temporarily unavailable. Please try again later."
      };
    }
  }
}

module.exports = new TravelEngine();
