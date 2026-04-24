// Travel Engine - Central business logic orchestrator
const transportService = require("../services/transportService");
const hotelService = require("../services/hotelService");
const itineraryService = require("../services/itineraryService");
const budgetService = require("../services/budgetService");
const distanceRules = require("../utils/distanceRules");
const weatherService = require("../services/weatherService");
const geminiService = require("../services/geminiService");

class TravelEngine {
  // Get transport options based on mode
  async getTransport(origin, destination, mode, budget, people) {
    try {
      console.log(`🚀 Getting ${mode} options: ${origin} → ${destination}`);
      
      const distanceInfo = distanceRules.getRecommendedTransport(origin, destination);
      
      // Check if requested mode is available for this route
      if (distanceInfo.unavailable.includes(mode.toLowerCase())) {
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
      
      if (!result) {
        return {
          success: false,
          message: "⚠️ Travel information temporarily unavailable. Please try again later."
        };
      }
      
      return {
        success: true,
        data: result,
        recommended: distanceInfo.preferred
      };
      
    } catch (err) {
      console.error("❌ Travel Engine error:", err.message);
      return {
        success: false,
        message: "⚠️ Travel information temporarily unavailable. Please try again later."
      };
    }
  }

  // Get hotel recommendations
  async getHotels(destination, budget, days) {
    try {
      console.log(`🏨 Getting hotels in ${destination}`);
      const result = await hotelService.getHotels(destination, budget, days);
      
      if (!result) {
        return {
          success: false,
          message: "⚠️ Hotel information temporarily unavailable. Please try again later."
        };
      }
      
      return { success: true, data: result };
      
    } catch (err) {
      console.error("❌ Travel Engine error:", err.message);
      return {
        success: false,
        message: "⚠️ Hotel information temporarily unavailable. Please try again later."
      };
    }
  }

  // Get tourist places
  async getTouristPlaces(destination) {
    try {
      console.log(`🎯 Getting tourist places in ${destination}`);
      // For now, use simple fallback - can be enhanced with AI later
      return {
        success: true,
        data: `🎯 *Top Places in ${destination}*\n\n` +
              `1️⃣ Main Attraction\nExplore the famous spot\n\n` +
              `2️⃣ Historical Site\nLearn about history\n\n` +
              `3️⃣ Local Market\nShopping and food\n\n` +
              `4️⃣ Scenic Viewpoint\nGreat photos\n\n` +
              `5️⃣ Cultural Center\nArt and traditions\n\n` +
              `6️⃣ Hidden Gem\nOffbeat location`
      };
    } catch (err) {
      console.error("❌ Travel Engine error:", err.message);
      return {
        success: false,
        message: "⚠️ Tourist places information temporarily unavailable. Please try again later."
      };
    }
  }

  // Get itinerary
  async getItinerary(destination, days, people, budget) {
    try {
      console.log(`📅 Getting itinerary for ${destination} (${days} days)`);
      const result = await itineraryService.getItinerary(destination, days, people, budget);
      
      if (!result) {
        return {
          success: false,
          message: "⚠️ Itinerary information temporarily unavailable. Please try again later."
        };
      }
      
      return { success: true, data: result };
      
    } catch (err) {
      console.error("❌ Travel Engine error:", err.message);
      return {
        success: false,
        message: "⚠️ Itinerary information temporarily unavailable. Please try again later."
      };
    }
  }

  // Get budget breakdown
  async getBudget(destination, totalBudget, people, days) {
    try {
      console.log(`💰 Getting budget plan for ${destination}`);
      const result = await budgetService.getBudgetPlan(destination, totalBudget, people, days);
      
      if (!result) {
        return {
          success: false,
          message: "⚠️ Budget information temporarily unavailable. Please try again later."
        };
      }
      
      return { success: true, data: result };
      
    } catch (err) {
      console.error("❌ Travel Engine error:", err.message);
      return {
        success: false,
        message: "⚠️ Budget information temporarily unavailable. Please try again later."
      };
    }
  }
  async getWeather(destination) {
    try {
      console.log(`🌦 [Engine] Getting weather for ${destination}`);
      const result = await weatherService.getWeather(destination);

      if (!result) {
        return {
          success: false,
          message: "⚠️ Weather data not available",
        };
      }

      // Format weather data for WhatsApp
      const weatherMessage = `🌦 *WEATHER* — ${result.city}\n\n🌡️ Temperature: ${result.temperature}°C\n☁️ Condition: ${result.condition}\n💨 Wind Speed: ${result.windSpeed} km/h`;

      return {
        success: true,
        data: weatherMessage,
      };
    } catch (err) {
      console.error("❌ [Engine] Weather error:", err.message);
      return {
        success: false,
        message: "⚠️ Weather service unavailable",
      };
    }
  }

  // Get food guide for destination
  async getFoodGuide(destination) {
    try {
      console.log(`🍛 [Engine] Getting food guide for ${destination}`);
      
      const prompt = `Generate a clean and structured food guide for ${destination}, India for travelers.

Output must be strictly formatted for WhatsApp.

FORMAT EXACTLY:

🍛 *Famous Dishes*
• item
• item
• item

🍢 *Street Food*
• item
• item
• item

🍰 *Desserts*
• item
• item

🥤 *Drinks*
• item
• item

💡 *Tip:*
<one short helpful food tip>

RULES:
- Only include real and popular food from ${destination}
- Maximum 3 items per section
- Do NOT include explanations or descriptions
- Do NOT include prices
- Do NOT add extra text before or after
- Keep it clean and readable`;

      const response = await geminiService.generateAIResponse(prompt);
      
      if (!response) {
        // Fallback food guide
        return {
          success: true,
          data: `🍛 *FOOD GUIDE* — ${destination}\n\n🍛 *Famous Dishes*\n• Local specialty dish 1\n• Local specialty dish 2\n• Local specialty dish 3\n\n🍢 *Street Food*\n• Popular street snack 1\n• Popular street snack 2\n• Popular street snack 3\n\n🍰 *Desserts*\n• Traditional sweet 1\n• Traditional sweet 2\n\n🥤 *Drinks*\n• Local beverage 1\n• Local beverage 2\n\n💡 *Tip:*\nTry food at busy stalls for freshness and best taste.`,
        };
      }

      return {
        success: true,
        data: response,
      };
    } catch (err) {
      console.error("❌ [Engine] Food guide error:", err.message);
      return {
        success: false,
        message: "⚠️ Food guide unavailable",
      };
    }
  }
}

module.exports = new TravelEngine();
