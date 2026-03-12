// Transport Engine - Generate comprehensive transport options
// Provides both train and bus options with detailed formatting

const geminiService = require('../services/geminiService');

class TransportEngine {

  async getTransportOptions(origin, destination) {
    try {
      console.log(`🚆 [Transport] Getting options: ${origin} → ${destination}`);

      const [trainResponse, busResponse] = await Promise.all([
        this.getTrainOptions(origin, destination),
        this.getBusOptions(origin, destination)
      ]);

      let combinedResponse = `🚆 *TRAIN OPTIONS*\n${origin} → ${destination}\n\n`;
      combinedResponse += trainResponse;

      combinedResponse += `\n\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      combinedResponse += `🚌 *BUS OPTIONS*\n${origin} → ${destination}\n\n`;
      combinedResponse += busResponse;

      combinedResponse += `\n\n💡 *Travel Tips*\n`;
      combinedResponse += `• Book trains early for better prices\n`;
      combinedResponse += `• Buses are flexible with boarding points\n`;
      combinedResponse += `• Compare duration before choosing\n`;

      return combinedResponse;

    } catch (error) {
      console.error('❌ [Transport] Engine error:', error.message);
      return '⚠️ Transport information temporarily unavailable. Please try again.';
    }
  }

  async getTrainOptions(origin, destination) {

    const prompt = `Generate 5 realistic Indian Railways trains from ${origin} to ${destination}.

Format exactly like this table:

Train Name | Train No | Departure | Arrival | Duration | Frequency
-----------------------------------------------------------
Vande Bharat | 20702 | 19:45 | 23:42 | 3h57m | Daily
Palnadu SF | 12747 | 05:45 | 10:15 | 4h30m | Daily
LPI Intercity | 12795 | 18:17 | 22:10 | 3h53m | Daily
Sabari SF | 20630 | 06:00 | 11:02 | 5h02m | Daily
Narayanadri SF | 12733 | 00:30 | 05:35 | 5h05m | Daily

Estimated Ticket Prices:
General: ₹150
Sleeper: ₹350
3AC: ₹800
2AC: ₹1200

Return ONLY the table.`;

    try {

      const response = await geminiService.generateAIResponse(prompt);

      const text =
        response?.text ||
        response?.response ||
        response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        response;

      if (!text || text.length < 20) {
        return this.getDefaultTrainResponse();
      }

      return text;

    } catch (error) {
      console.error('❌ [Transport] Train error:', error.message);
      return this.getDefaultTrainResponse();
    }
  }

  async getBusOptions(origin, destination) {

    const prompt = `Generate 5 realistic bus services from ${origin} to ${destination} in India.

Format exactly like this table:

Operator | Bus Type | Departure | Arrival | Duration | Price
-----------------------------------------------------------
APSRTC | Super Luxury | 22:00 | 04:30 | 6h30m | ₹650
TGSRTC | Indra AC | 21:30 | 04:00 | 6h30m | ₹700
IntrCity | AC Sleeper | 23:00 | 05:30 | 6h30m | ₹850
ZingBus | AC Seater | 22:15 | 04:45 | 6h30m | ₹600
Morning Star | AC Sleeper | 23:30 | 06:00 | 6h30m | ₹900

Return ONLY the table.`;

    try {

      const response = await geminiService.generateAIResponse(prompt);

      const text =
        response?.text ||
        response?.response ||
        response?.candidates?.[0]?.content?.parts?.[0]?.text ||
        response;

      if (!text || text.length < 20) {
        return this.getDefaultBusResponse();
      }

      return text;

    } catch (error) {
      console.error('❌ [Transport] Bus error:', error.message);
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