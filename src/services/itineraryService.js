// Itinerary Service - Generate day-by-day travel plans with caching
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cacheManager = require("../cache/cacheManager");
const logger = require("../config/logger");

let genAI = null;

function initializeGemini() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) return null;
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

function getGeminiModel() {
  const ai = initializeGemini();
  if (!ai) throw new Error("Gemini AI not initialized");
  return ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
}

async function generateGeminiResponse(prompt) {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    return (await result.response).text().trim();
  } catch (err) {
    logger.error("❌ Gemini API error", {
      error: err.message,
    });
    return null;
  }
}

async function getItinerary(destination, days, people, budget, travelStyle = 'general') {
  try {
    // Generate cache key
    const cacheKey = cacheManager.generateItineraryKey(destination, days, travelStyle);

    // Use cache-through pattern (longer TTL for itineraries)
    const result = await cacheManager.cachedCall(
      cacheKey,
      cacheManager.TTL_CONFIG.ITINERARY,
      async () => {
        const dailyBudget = Math.floor(budget / days);

        const prompt = `${days}-day itinerary for ${destination}, India.

Travelers: ${people}, Daily budget: ~₹${dailyBudget}
Style: ${travelStyle}

Generate day-by-day plan:
Day 1
Morning: Activity
Afternoon: Lunch spot  
Evening: Activity

Rules:
- One line per activity
- Include food spots
- No paragraphs
- EXACTLY ${days} days

Return ONLY the list.`;

        const response = await generateGeminiResponse(prompt);
        
        if (!response) {
          return {
            success: false,
            message: "⚠️ Itinerary generation failed. Please try again later.",
          };
        }

        return {
          success: true,
          data: response,
        };
      }
    );

    if (result.fromCache) {
      logger.info('📦 Itinerary served from cache', {
        destination,
        days,
        cacheKey,
      });
    }

    return result.data.success ? result.data.data : result.data.message;

  } catch (error) {
    logger.error('Itinerary service error', {
      destination,
      error: error.message,
    });
    return "⚠️ Itinerary generation failed. Please try again later.";
  }
}

// Parse Gemini response into structured itinerary data
function parseItineraryResponse(text, days) {
  const lines = text.split('\n').filter(l => l.trim());
  const plan = [];
  let currentDay = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (/day\s*\d+/i.test(trimmed)) {
      if (Object.keys(currentDay).length > 0) {
        plan.push(currentDay);
      }
      currentDay = {};
    } else if (trimmed.toLowerCase().includes('morning')) {
      currentDay.morning = trimmed.replace(/morning:/i, '').trim();
    } else if (trimmed.toLowerCase().includes('afternoon') || trimmed.toLowerCase().includes('lunch')) {
      currentDay.afternoon = trimmed.replace(/(afternoon:|lunch)/i, '').trim();
    } else if (trimmed.toLowerCase().includes('evening')) {
      currentDay.evening = trimmed.replace(/evening:/i, '').trim();
    }
  }
  
  if (Object.keys(currentDay).length > 0) {
    plan.push(currentDay);
  }
  
  return plan.slice(0, days);
}

module.exports = { getItinerary };
