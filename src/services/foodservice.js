const geminiService = require("./geminiService");

class FoodService {

  async getFoodGuide(city) {

    const prompt = `
Generate a food guide for tourists visiting ${city}, India.

Format EXACTLY like this:

🍛 Famous Dishes
• dish
• dish
• dish
• dish

🍢 Street Food

• food
• food
• food
• food

🍰 Desserts
• dessert
• dessert
• dessert
• dessert

🥤 Drinks
• drink
• drink

Rules:
- Only give food related to ${city}
- Maximum 4 items per category
- No explanations
- Clean WhatsApp friendly format
`;

    const response = await geminiService.generateAIResponse(prompt);

    return response;
  }
}

module.exports = new FoodService();
