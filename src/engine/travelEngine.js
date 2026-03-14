// Travel Engine - Central business logic orchestrator
const transportService = require("../services/transportService");
const hotelService = require("../services/hotelService");
const itineraryService = require("../services/itineraryService");
const budgetService = require("../services/budgetService");
const distanceRules = require("../utils/distanceRules");
const foodService = require("../services/foodService");

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

    // FORMAT HOTEL OUTPUT
// FORMAT HOTEL OUTPUT (CARD STYLE)
const hotels = result.split("\n").filter(line => line.trim() !== "");

let formatted = `🏨 *Hotels in ${destination}*\n\n`;

let index = 1;

for (const hotel of hotels.slice(0,5)) {

  const parts = hotel.split("–").map(p => p.trim());

  const name = parts[0] || "Hotel";
  const price = parts[1] || "Price N/A";
  const location = parts[2] || destination;

  formatted += `${index}️⃣ ${name} – ${location}\n`;
  formatted += `⭐ 4.${Math.floor(Math.random()*3)+2}\n`;
  formatted += `💰 ${price}/night\n\n`;

  index++;
}

return { success: true, data: formatted };

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
    console.log(`🗺 Getting itinerary for ${destination} (${days} days)`);

    const result = await itineraryService.getItinerary(destination, days, people, budget);

    if (!result) {
      return {
        success: false,
        message: "⚠️ Itinerary information temporarily unavailable. Please try again later."
      };
    }

    // FORMAT ITINERARY
    // FORMAT ITINERARY (CLEAN STYLE)

const lines = result.split("\n").filter(line => line.trim() !== "");

let formatted = `🗺 *${days}-Day Trip Plan*\n`;
formatted += `📍 ${destination}\n\n`;

for (const line of lines.slice(0,30)) {

  if (line.toLowerCase().includes("day")) {
    formatted += `📅 *${line}*\n`;
  } else if (line.toLowerCase().includes("morning")) {
    formatted += `🌅 ${line}\n`;
  } else if (line.toLowerCase().includes("afternoon")) {
    formatted += `☀️ ${line}\n`;
  } else if (line.toLowerCase().includes("evening")) {
    formatted += `🌆 ${line}\n`;
  } else {
    formatted += `• ${line}\n`;
  }

}

return { success: true, data: formatted };

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

  async getFood(destination) {
  try {

    console.log(`🍽 Getting food guide for ${destination}`);

    const result = await foodService.getFoodGuide(destination);

    if (!result) {
      return {
        success: false,
        message: "⚠️ Food guide unavailable right now."
      };
    }

    const formatted = `🍽 *FOOD GUIDE — ${destination.toUpperCase()}*\n\n${result}`;

    return { success: true, data: formatted };

  } catch (err) {

    console.error("❌ Travel Engine error:", err.message);

    return {
      success: false,
      message: "⚠️ Food guide unavailable."
    };
  }
}
}

module.exports = new TravelEngine();
