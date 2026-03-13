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

    const prompt = `Generate realistic Indian Railways trains from ${origin} to ${destination}.

Return exactly 5 trains in this WhatsApp friendly format:

🚆 TRAIN OPTIONS
${origin} → ${destination}

1️⃣ Train Name: Vande Bharat Express
🚉 Train No: 20702
⏰ Departure: 19:45
🏁 Arrival: 23:42
⌛ Duration: 3h 57m
📅 Frequency: Daily

2️⃣ Train Name: Palnadu SF Express
🚉 Train No: 12747
⏰ Departure: 05:45
🏁 Arrival: 10:15
⌛ Duration: 4h 30m
📅 Frequency: Daily

After trains add ticket prices:

💰 Estimated Ticket Prices
General: ₹150
Sleeper: ₹350
3AC: ₹900
2AC: ₹1400

Rules:
- Do NOT use tables
- Do NOT use | symbols
- Use emoji format exactly like above
- WhatsApp readable format only
`;

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

    const prompt = `Generate realistic bus options from ${origin} to ${destination} in India.

Return exactly 8 buses in this WhatsApp friendly format:

🚌 BUS OPTIONS
${origin} → ${destination}

1️⃣ Operator: IntrCity SmartBus
🛏 Bus Type: AC Sleeper
⏰ Departure: 19:00
🏁 Arrival: 05:00
⌛ Duration: 10h
💰 Price: ₹3200

2️⃣ Operator: ZingBus
🛏 Bus Type: AC Sleeper
⏰ Departure: 20:30
🏁 Arrival: 06:00
⌛ Duration: 9h 30m
💰 Price: ₹3500

Rules:
- Do NOT use tables
- No | symbols
- WhatsApp readable layout
- Only 8 buses
`;

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
return `🚆 *TRAIN OPTIONS*

1️⃣ Vande Bharat Express
🚆 Train No: 20702
🕒 Departure: 19:45
🕒 Arrival: 23:42
⏱ Duration: 3h57m
📅 Frequency: Daily

2️⃣ Palnadu SF Express
🚆 Train No: 12747
🕒 Departure: 05:45
🕒 Arrival: 10:15
⏱ Duration: 4h30m
📅 Frequency: Daily

💰 *Estimated Ticket Prices*

General: ₹150  
Sleeper: ₹350  
3AC: ₹800  
2AC: ₹1200`;
}

  getDefaultBusResponse() {
return `🚌 *BUS OPTIONS*

1️⃣ APSRTC Super Luxury
🕒 Departure: 22:00
🕒 Arrival: 04:30
⏱ Duration: 6h30m
💰 Price: ₹650

2️⃣ IntrCity AC Sleeper
🕒 Departure: 23:00
🕒 Arrival: 05:30
⏱ Duration: 6h30m
💰 Price: ₹850

3️⃣ ZingBus AC Seater
🕒 Departure: 22:15
🕒 Arrival: 04:45
⏱ Duration: 6h30m
💰 Price: ₹600`;
}
module.exports = new TransportEngine();