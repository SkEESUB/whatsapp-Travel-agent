// Itinerary Engine - Generate day-by-day travel itineraries
// Provides structured daily plans with activities and costs

const geminiService = require('../services/geminiService');

class ItineraryEngine {
  /**
   * Generate itinerary for a destination
   * @param {string} destination - Destination city
   * @param {number} days - Number of days
   * @returns {Promise<string>} - Formatted itinerary
   */
  async generateItinerary(destination, days) {
    try {
      console.log(`📅 [Itinerary] Generating ${days}-day itinerary for ${destination}`);

      const prompt = `Generate a detailed ${days}-day travel itinerary for ${destination}, India.

Format EXACTLY like this:

📍 ${destination.toUpperCase()} ${days} DAY ITINERARY

Day 1
🌅 Morning: Charminar visit (2 hours)
☕ Breakfast: Shadab Hotel (₹300)
🏛️ Afternoon: Mecca Masjid & Laad Bazaar (3 hours)
🍽️ Lunch: Grand Hotel (₹500)
🌆 Evening: Chowmahalla Palace (2 hours)
🍽️ Dinner: Cafe Bahar (₹600)
💰 Day Cost: ₹1700

Day 2
🌅 Morning: Golconda Fort (3 hours)
☕ Breakfast: Green Bawarchi (₹400)
🏛️ Afternoon: Qutub Shahi Tombs (2 hours)
🍽️ Lunch: Meridian Restaurant (₹600)
🌆 Evening: Birla Mandir & Hussain Sagar (3 hours)
🍽️ Dinner: Paradise Biryani (₹800)
💰 Day Cost: ₹2200

[Continue for all ${days} days...]

Include:
- Specific attractions with visit duration
- Famous food spots with estimated cost
- Mix of historical, cultural, and leisure activities
- Realistic timing for each activity
- Daily cost estimate

Rules:
- One line per activity
- Include cost estimates in parentheses
- Use emojis for visual clarity
- No long paragraphs
- Practical, achievable schedule

Return ONLY the formatted itinerary.`;

      const response = await geminiService.generateAIResponse(prompt);

      if (!response) {
        return this.getDefaultItinerary(destination, days);
      }

      // Add total cost summary
      let finalResponse = response;
      finalResponse += '\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
      finalResponse += `💰 *Estimated Total Budget*\n`;
      finalResponse += `• Food: ₹${days * 1500}\n`;
      finalResponse += `• Sightseeing: ₹${days * 500}\n`;
      finalResponse += `• Local transport: ₹${days * 300}\n`;
      finalResponse += `• Shopping: ₹2000 (optional)\n`;
      finalResponse += `\n*Total per person: ₹${(days * 2300) + 2000}*`;

      return finalResponse;

    } catch (error) {
      console.error('❌ [Itinerary] Error:', error.message);
      return '⚠️ Itinerary information temporarily unavailable. Please try again later.';
    }
  }

  getDefaultItinerary(destination, days) {
    let response = `📍 ${destination.toUpperCase()} ${days} DAY ITINERARY\n\n`;

    for (let i = 1; i <= days; i++) {
      response += `*Day ${i}*\n`;
      response += `🌅 Morning: Local sightseeing\n`;
      response += `☕ Breakfast: Local restaurant\n`;
      response += `🏛️ Afternoon: Main attractions\n`;
      response += `🍽️ Lunch: Regional cuisine\n`;
      response += `🌆 Evening: Leisure time\n`;
      response += `🍽️ Dinner: Popular eatery\n`;
      response += `💰 Day Cost: ₹1500\n\n`;
    }

    response += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    response += `💰 *Estimated Total Budget*\n`;
    response += `• Food: ₹${days * 1500}\n`;
    response += `• Sightseeing: ₹${days * 500}\n`;
    response += `• Local transport: ₹${days * 300}\n`;
    response += `• Shopping: ₹2000 (optional)\n\n`;
    response += `*Total per person: ₹${(days * 2300) + 2000}*`;

    return response;
  }
}

module.exports = new ItineraryEngine();
