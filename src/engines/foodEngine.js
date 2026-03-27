// Food Engine - Generate local food guides for travelers
// Provides structured food recommendations with dishes, street food, desserts, and drinks

const geminiService = require('../services/geminiService');

class FoodEngine {
  /**
   * Get food guide for a city
   * @param {string} city - Destination city
   * @returns {Promise<string>} - Formatted food guide
   */
  async getFoodGuide(city) {
    try {
      console.log(`🍛 [Food] Getting food guide for ${city}`);

      const prompt = `Generate a clean and structured food guide for ${city}, India for travelers.

Output must be strictly formatted for WhatsApp.

FORMAT EXACTLY:

🍛 Famous Dishes
• item
• item
• item

🍢 Street Food
• item
• item
• item

🍰 Desserts
• item
• item

🥤 Drinks
• item
• item

💡 Tip:
<one short helpful food tip>

RULES:
- Only include real and popular food from ${city}
- Maximum 3 items per section
- Do NOT include explanations or descriptions
- Do NOT include prices
- Do NOT add extra text before or after
- Do NOT change format
- Keep it clean and readable
- Output only the formatted result`;

      const response = await geminiService.generateAIResponse(prompt);

      if (!response) {
        return this.getDefaultFoodGuide(city);
      }

      // Clean up response - remove any extra whitespace
      const cleanedResponse = response.trim();

      return cleanedResponse;

    } catch (error) {
      console.error('❌ [Food] Error:', error.message);
      return '⚠️ Food information temporarily unavailable. Please try again later.';
    }
  }

  getDefaultFoodGuide(city) {
    return `🍛 Famous Dishes in ${city}
• Local specialty dish 1
• Local specialty dish 2
• Local specialty dish 3

🍢 Street Food
• Popular street snack 1
• Popular street snack 2
• Popular street snack 3

🍰 Desserts
• Traditional sweet 1
• Traditional sweet 2

🥤 Drinks
• Local beverage 1
• Local beverage 2

💡 Tip:
Try food at busy stalls for freshness and best taste.`;
  }
}

module.exports = new FoodEngine();
