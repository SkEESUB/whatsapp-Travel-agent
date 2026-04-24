// Food Service - Generate local food guide with caching
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cacheManager = require("../cache/cacheManager");
const logger = require("../config/logger");

let genAI = null;

function initializeGemini() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      logger.error("❌ GEMINI_API_KEY is NOT loaded from .env");
      return null;
    }
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
    const response = await result.response;
    return response.text().trim();
  } catch (err) {
    logger.error("❌ Gemini API error", {
      error: err.message,
    });
    return null;
  }
}

/**
 * Get food guide for a destination (with caching)
 */
async function getFoodGuide(destination) {
  try {
    // Generate cache key
    const cacheKey = cacheManager.generateFoodKey(destination);

    // Use cache-through pattern (long TTL - food doesn't change often)
    const result = await cacheManager.cachedCall(
      cacheKey,
      cacheManager.TTL_CONFIG.FOOD,
      async () => {
        const prompt = `Generate a clean and structured food guide for ${destination}, India.

Include:
1. Famous local dishes (5-7 items)
2. Must-try street food (3-5 items)
3. Best restaurants/cafes (3-5 places)
4. Budget food spots (2-3 places)
5. Food tips for tourists

Format:
🍛 *LOCAL SPECIALTIES*
• Dish name - Brief description

🥘 *STREET FOOD*
• Item name - Where to find

🍽️ *RESTAURANTS*
• Restaurant name - Area - Price range

💰 *BUDGET SPOTS*
• Place name - What to order

💡 *TIPS*
• Tip 1
• Tip 2

Rules:
- Real food names
- Real places
- Clean WhatsApp format
- No long paragraphs

Return ONLY the guide.`;

        const response = await generateGeminiResponse(prompt);
        
        if (!response) {
          return {
            success: false,
            message: `🍛 *FOOD GUIDE* — ${destination}\n\n⚠️ Food guide temporarily unavailable. Please try again later.`,
          };
        }

        return {
          success: true,
          data: `🍛 *FOOD GUIDE* — ${destination}\n\n${response}`,
        };
      }
    );

    if (result.fromCache) {
      logger.info('📦 Food guide served from cache', {
        destination,
        cacheKey,
      });
    }

    return result.data.success ? result.data.data : result.data.message;

  } catch (error) {
    logger.error('Food guide service error', {
      destination,
      error: error.message,
    });
    return `🍛 *FOOD GUIDE* — ${destination}\n\n⚠️ Food guide unavailable. Please try again.`;
  }
}

module.exports = {
  getFoodGuide,
};
