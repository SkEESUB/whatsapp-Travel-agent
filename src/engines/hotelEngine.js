// Hotel Engine - Generate hotel recommendations
// Provides structured hotel options with ratings and amenities

const geminiService = require('../services/geminiService');

class HotelEngine {
  /**
   * Get hotel options for a destination
   * @param {string} destination - Destination city
   * @param {number} days - Number of days
   * @param {number} people - Number of people
   * @returns {Promise<string>} - Formatted hotel options
   */
  async getHotelOptions(destination, days, people) {
    try {
      console.log(`🏨 [Hotel] Getting hotels in ${destination} for ${days} days, ${people} people`);

      const prompt = `Generate realistic hotel options in ${destination}, India.

Provide EXACTLY 5 hotels with this format:

Hotel | Rating | Price | Area | Amenities
------------------------------------------------
Taj Deccan | ⭐4.5 | ₹6500 | Banjara Hills | Pool, Wifi, Gym
Novotel Hyderabad | ⭐4.3 | ₹5200 | Hitech City | Gym, Wifi, Spa
ITC Kakatiya | ⭐4.6 | ₹7200 | Begumpet | Spa, Pool, Restaurant
Marigold Grand | ⭐4.2 | ₹4800 | Ameerpet | Wifi, Restaurant
Holiday Inn | ⭐4.4 | ₹5400 | Gachibowli | Gym, Pool, Wifi

Include price range:
Budget: ₹1500-₹3000
Mid-Range: ₹3500-₹6000
Premium: ₹6500+

Rules:
- Real hotel names
- Real areas/localities
- Realistic ratings (3.5-5.0)
- Realistic prices in INR
- Common amenities (Wifi, Pool, Gym, Spa, Restaurant, AC)
- Mix of budget categories
- No explanations or paragraphs
- Clean table format only

Return ONLY the formatted list.`;

      const response = await geminiService.generateAIResponse(prompt);

      if (!response) {
        return this.getDefaultHotelResponse(destination);
      }

      // Format the response
      let formattedResponse = `🏨 *HOTEL OPTIONS* — ${destination}\n\n`;
      formattedResponse += response;
      formattedResponse += '\n\n💡 *Booking Tips*:\n';
      formattedResponse += '• Book at least 2-3 days in advance\n';
      formattedResponse += '• Check cancellation policy\n';
      formattedResponse += '• Compare prices on multiple platforms';

      return formattedResponse;

    } catch (error) {
      console.error('❌ [Hotel] Error:', error.message);
      return '⚠️ Hotel information temporarily unavailable. Please try again later.';
    }
  }

  getDefaultHotelResponse(destination) {
    return `🏨 *HOTEL OPTIONS* — ${destination}\n\n` +
      `Hotel | Rating | Price | Area | Amenities\n` +
      `------------------------------------------------\n` +
      `Hotel Deccan | ⭐4.0 | ₹2500 | City Center | Wifi, AC\n` +
      `Grand Plaza | ⭐4.2 | ₹3500 | Main Market | Pool, Wifi\n` +
      `Comfort Inn | ⭐4.1 | ₹2800 | Railway Station | AC, Breakfast\n` +
      `Heritage Resort | ⭐4.3 | ₹4200 | Outskirts | Pool, Spa\n` +
      `Business Hotel | ⭐4.0 | ₹3000 | Business District | Wifi, Gym\n\n` +
      `💡 *Booking Tips*:\n` +
      `• Book at least 2-3 days in advance\n` +
      `• Check cancellation policy\n` +
      `• Compare prices on multiple platforms`;
  }
}

module.exports = new HotelEngine();
