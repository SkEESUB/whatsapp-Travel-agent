// Transport Engine - Generate comprehensive transport options
// Provides both train and bus options with detailed formatting

const geminiService = require('../services/geminiService');
const formatter = require('../utils/formatter');

class TransportEngine {
  /**
   * Get comprehensive transport options between two cities
   * @param {string} origin - Origin city
   * @param {string} destination - Destination city
   * @returns {Promise<string>} - Formatted transport options
   */
  async getTransportOptions(origin, destination) {
    try {
      console.log(`🚆 [Transport] Getting options: ${origin} → ${destination}`);

      // Get both train and bus options with individual error handling
      const [trainResponse, busResponse] = await Promise.all([
        this.getTrainOptions(origin, destination).catch(err => {
          console.error('❌ [Transport] Train error:', err.message);
          return this.getDefaultTrainResponse();
        }),
        this.getBusOptions(origin, destination).catch(err => {
          console.error('❌ [Transport] Bus error:', err.message);
          return this.getDefaultBusResponse();
        }),
      ]);

      // Combine responses
      let combinedResponse = `🚆 *TRAIN OPTIONS*\n${origin} → ${destination}\n\n`;
      combinedResponse += trainResponse;
      combinedResponse += '\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n';
      combinedResponse += `🚌 *BUS OPTIONS*\n${origin} → ${destination}\n\n`;
      combinedResponse += busResponse;

      // Add travel tips
      combinedResponse += '\n\n💡 *Travel Tips*:\n';
      combinedResponse += '• Book trains in advance for better prices\n';
      combinedResponse += '• Buses may take longer but are more flexible\n';
      combinedResponse += '• Check cancellation policies before booking';

      return combinedResponse;

    } catch (error) {
      console.error('❌ [Transport] Error:', error.message);
      return '⚠️ Transport information temporarily unavailable. Please try again later.';
    }
  }

  /**
   * Get train options using Gemini
   */
  async getTrainOptions(origin, destination) {
    const prompt = `Generate realistic Indian Railways train options from ${origin} to ${destination}.

Provide EXACTLY 5 trains with this format:

Train Name | Train No | Departure | Arrival | Duration | Frequency
-----------------------------------------------------------
Vande Bharat | 20702 | 19:45 | 23:42 | 3h57m | Daily
Palnadu SF | 12747 | 05:45 | 10:15 | 4h30m | Daily
LPI Intercity | 12795 | 18:17 | 22:10 | 3h53m | Daily
Sabari SF | 20630 | 06:00 | 11:02 | 5h02m | Daily
Narayanadri SF | 12733 | 00:30 | 05:35 | 5h05m | Daily

Estimated Ticket Prices:
General: ₹XXX
Sleeper: ₹XXX
3AC: ₹XXX
2AC: ₹XXX

Rules:
- Realistic train names and numbers
- Proper departure/arrival times
- Accurate duration calculations
- Realistic pricing
- No explanations or paragraphs
- Clean table format only

Return ONLY the formatted list.`;

    try {
      const response = await geminiService.generateAIResponse(prompt);
      return response || this.getDefaultTrainResponse();
    } catch (error) {
      console.error('❌ [Transport] Train API error:', error.message);
      return this.getDefaultTrainResponse();
    }
  }

  /**
   * Get bus options using Gemini
   */
  async getBusOptions(origin, destination) {
    const prompt = `Generate realistic bus options from ${origin} to ${destination} in India.

Provide EXACTLY 5 buses with this format:

Operator | Bus Type | Departure | Arrival | Duration | Price
-----------------------------------------------------------
APSRTC | Super Luxury | 22:00 | 04:30 | 6h30m | ₹650
TGSRTC | Indra AC | 21:30 | 04:00 | 6h30m | ₹700
IntrCity | AC Sleeper | 23:00 | 05:30 | 6h30m | ₹850
ZingBus | AC Seater | 22:15 | 04:45 | 6h30m | ₹600
Morning Star | AC Sleeper | 23:30 | 06:00 | 6h30m | ₹900

Rules:
- Mix of government and private operators
- Realistic bus types (AC Sleeper, AC Seater, Super Luxury, etc.)
- Proper departure/arrival times
- Realistic pricing
- No explanations or paragraphs
- Clean table format only

Return ONLY the formatted list.`;

    try {
      const response = await geminiService.generateAIResponse(prompt);
      return response || this.getDefaultBusResponse();
    } catch (error) {
      console.error('❌ [Transport] Bus API error:', error.message);
      return this.getDefaultBusResponse();
    }
  }

  getDefaultTrainResponse() {
    return `Train Name | Train No | Departure | Arrival | Duration | Frequency
-----------------------------------------------------------
Express Special | 12345 | 06:00 | 12:00 | 6h00m | Daily
Passenger | 56789 | 08:30 | 15:30 | 7h00m | Daily
Superfast | 20123 | 14:00 | 19:30 | 5h30m | Daily
Intercity | 12789 | 17:45 | 23:15 | 5h30m | Daily
Mail Express | 10456 | 21:00 | 04:00 | 7h00m | Daily

Estimated Ticket Prices:
General: ₹150
Sleeper: ₹350
3AC: ₹800
2AC: ₹1200`;
  }

  getDefaultBusResponse() {
    return `Operator | Bus Type | Departure | Arrival | Duration | Price
-----------------------------------------------------------
State RTC | Deluxe | 21:00 | 04:00 | 7h00m | ₹550
Private Operator | AC Seater | 22:00 | 05:00 | 7h00m | ₹650
IntrCity | AC Sleeper | 23:00 | 06:00 | 7h00m | ₹800
Orange Travels | AC Sleeper | 22:30 | 05:30 | 7h00m | ₹750
ZingBus | Semi Deluxe | 20:00 | 03:30 | 7h30m | ₹500`;
  }
}

module.exports = new TransportEngine();
