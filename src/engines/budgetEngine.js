// Budget Engine - Generate travel budget estimates
// Provides comprehensive cost breakdown for trips

const geminiService = require('../services/geminiService');

class BudgetEngine {
  /**
   * Calculate trip budget estimate
   * @param {string} destination - Destination city
   * @param {number} days - Number of days
   * @param {number} people - Number of people
   * @returns {Promise<string>} - Formatted budget breakdown
   */
  async calculateBudget(destination, days, people) {
    try {
      console.log(`💰 [Budget] Calculating budget for ${destination}, ${days} days, ${people} people`);

      const prompt = `Generate a detailed budget breakdown for a trip to ${destination}, India.

Trip details:
- Duration: ${days} days
- People: ${people}
- Category: Mid-range travel

Format EXACTLY like this:

💰 TRIP BUDGET — ${destination}
For ${people} people (${days} days)

━━━━━━━━━━━━━━━━━━━━━━

🚍 TRANSPORT (Local)
Auto/Taxi: ₹800/day × ${days} days = ₹${800 * days}
Metro/Bus: ₹200/day × ${days} days = ₹${200 * days}
──────────────────────
Subtotal: ₹${1000 * days}

🏨 ACCOMMODATION
Hotel (3★): ₹3500/night × ${days - 1} nights = ₹${3500 * (days - 1)}

🍽️ FOOD
Breakfast: ₹300/day × ${days} days = ₹${300 * days}
Lunch: ₹500/day × ${days} days = ₹${500 * days}
Dinner: ₹600/day × ${days} days = ₹${600 * days}
Snacks: ₹200/day × ${days} days = ₹${200 * days}
──────────────────────
Subtotal: ₹${1600 * days}

🎯 SIGHTSEEING
Entry fees: ₹500/day × ${days} days = ₹${500 * days}
Activities: ₹1000/day × ${days} days = ₹${1000 * days}
──────────────────────
Subtotal: ₹${1500 * days}

🛍️ SHOPPING (Optional)
Souvenirs: ₹2000
Clothes: ₹3000
──────────────────────
Subtotal: ₹5000

━━━━━━━━━━━━━━━━━━━━━━

📊 TOTAL BREAKDOWN

Transport: ₹${1000 * days}
Accommodation: ₹${3500 * (days - 1)}
Food: ₹${1600 * days}
Sightseeing: ₹${1500 * days}
Shopping: ₹5000
──────────────────────
GRAND TOTAL: ₹${this.calculateTotal(days)}

Per Person: ₹${Math.floor(this.calculateTotal(days) / people)}

Rules:
- Realistic prices for Indian travel
- Clear section headers
- Show calculations
- Include emojis
- No explanations
- Clean format only

Return ONLY the formatted budget.`;

      const response = await geminiService.generateAIResponse(prompt);

      if (!response) {
        return this.getDefaultBudget(destination, days, people);
      }

      return response;

    } catch (error) {
      console.error('❌ [Budget] Error:', error.message);
      return '⚠️ Budget information temporarily unavailable. Please try again later.';
    }
  }

  calculateTotal(days) {
    const transport = 1000 * days;
    const accommodation = 3500 * (days - 1);
    const food = 1600 * days;
    const sightseeing = 1500 * days;
    const shopping = 5000;
    return transport + accommodation + food + sightseeing + shopping;
  }

  getDefaultBudget(destination, days, people) {
    const transport = 1000 * days;
    const accommodation = 3500 * (days - 1);
    const food = 1600 * days;
    const sightseeing = 1500 * days;
    const shopping = 5000;
    const total = this.calculateTotal(days);
    const perPerson = Math.floor(total / people);

    return `💰 TRIP BUDGET — ${destination}\n` +
      `For ${people} people (${days} days)\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🚍 *TRANSPORT (Local)*\n` +
      `Auto/Taxi: ₹800/day × ${days} days = ₹${transport}\n\n` +
      `🏨 *ACCOMMODATION*\n` +
      `Hotel (3★): ₹3500/night × ${days - 1} nights = ₹${accommodation}\n\n` +
      `🍽️ *FOOD*\n` +
      `Breakfast: ₹300/day × ${days} days = ₹${300 * days}\n` +
      `Lunch: ₹500/day × ${days} days = ₹${500 * days}\n` +
      `Dinner: ₹600/day × ${days} days = ₹${600 * days}\n` +
      `Snacks: ₹200/day × ${days} days = ₹${200 * days}\n` +
      `Subtotal: ₹${food}\n\n` +
      `🎯 *SIGHTSEEING*\n` +
      `Entry fees: ₹500/day × ${days} days = ₹${sightseeing}\n` +
      `Activities: ₹1000/day × ${days} days = ₹${sightseeing}\n` +
      `Subtotal: ₹${sightseeing}\n\n` +
      `🛍️ *SHOPPING (Optional)*\n` +
      `₹5000\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📊 *TOTAL BREAKDOWN*\n\n` +
      `Transport: ₹${transport}\n` +
      `Accommodation: ₹${accommodation}\n` +
      `Food: ₹${food}\n` +
      `Sightseeing: ₹${sightseeing}\n` +
      `Shopping: ₹5000\n` +
      `──────────────────────\n` +
      `*GRAND TOTAL: ₹${total}*\n\n` +
      `*Per Person: ₹${perPerson}*`;
  }
}

module.exports = new BudgetEngine();
