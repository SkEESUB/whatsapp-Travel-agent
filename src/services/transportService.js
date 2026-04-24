// Transport Service - Generates structured transport options with caching
// Enforces: EXACTLY 4 options, no repetition, clean format

const { GoogleGenerativeAI } = require("@google/generative-ai");
const distanceRules = require("../utils/distanceRules");
const cacheManager = require("../cache/cacheManager");
const bookingService = require("./bookingService");
const logger = require("../config/logger");

let genAI = null;

function initializeGemini() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is NOT loaded from .env");
      return null;
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log("✅ Gemini AI initialized successfully");
  }
  return genAI;
}

function getGeminiModel() {
  const ai = initializeGemini();
  if (!ai) {
    throw new Error("Gemini AI not initialized. Check GEMINI_API_KEY in .env");
  }
  return ai.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  });
}

async function generateGeminiResponse(prompt) {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    return text;
  } catch (err) {
    logger.error("❌ Gemini API error", {
      error: err.message,
    });
    return null;
  }
}

// BUS SERVICE - Generate exactly 4 bus options with caching
async function getBusOptions(origin, destination, budget, people) {
  try {
    // Generate cache key
    const cacheKey = cacheManager.generateTransportKey(origin, destination, 'bus');

    // Use cache-through pattern (shorter TTL for transport)
    const result = await cacheManager.cachedCall(
      cacheKey,
      cacheManager.TTL_CONFIG.TRANSPORT,
      async () => {
        const prompt = `Indian bus options.

Route: ${origin} to ${destination}
Budget: ₹${budget} total for ${people} people

Generate EXACTLY 4 different bus types:
1️⃣ AC Sleeper
2️⃣ Volvo Multi-Axle
3️⃣ Non-AC Sleeper  
4️⃣ AC Seater

Format for each:
🚌 *Operator Name*
⏰ Depart: HH:MM
🏁 Arrive: HH:MM
⌛ Duration: Xh Ym
💰 Price: ₹XXX
🎫 Type: Bus type

Rules:
- EXACTLY 4 options
- Different bus types
- Real Indian operators (APSRTC, Orange Travels, VRL, SRS)
- No explanations
- Clean WhatsApp format only

Return ONLY the list.`;

        const response = await generateGeminiResponse(prompt);
        
        if (!response) {
          return {
            success: false,
            message: `🚌 *BUS OPTIONS* — ${origin} → ${destination}\n\n⚠️ Bus information temporarily unavailable. Please try again later.`,
          };
        }

        return {
          success: true,
          data: `🚌 *BUS OPTIONS* — ${origin} → ${destination}\n👥 ${people} People | 💰 Budget: ₹${budget}\n\n${response}`,
        };
      }
    );

    if (result.fromCache) {
      logger.info('📦 Bus options served from cache', {
        origin,
        destination,
        cacheKey,
      });
    }

    return result.data.success ? result.data.data : result.data.message;

  } catch (err) {
    logger.error('❌ Bus service error', {
      origin,
      destination,
      error: err.message,
    });
    return `🚌 *BUS OPTIONS* — ${origin} → ${destination}\n\n⚠️ Bus service unavailable. Please try again.`;
  }
}

// TRAIN SERVICE - Generate train options with names and numbers (with caching)
async function getTrainOptions(origin, destination, budget, people) {
  try {
    const cacheKey = cacheManager.generateTransportKey(origin, destination, 'train');

    const result = await cacheManager.cachedCall(
      cacheKey,
      cacheManager.TTL_CONFIG.TRANSPORT,
      async () => {
        const prompt = `Indian Railways train options.

Route: ${origin} to ${destination}
Budget: ₹${budget} total for ${people} people

Generate EXACTLY 4 trains with:
Train Number + Name (e.g., "12722 Dakshin Express")

Format for each:
🚆 *Train Number - Train Name*
⏰ Depart: HH:MM
🏁 Arrive: HH:MM
⌛ Duration: Xh Ym
🎫 Classes: SL / 3A / 2A
💰 Price: ₹XXX–₹XXX

Rules:
- EXACTLY 4 trains
- Include train numbers
- Real train names
- No explanations
- Clean WhatsApp format only

Return ONLY the list.`;

        const response = await generateGeminiResponse(prompt);
        
        if (!response) {
          return {
            success: false,
            message: `🚆 *TRAIN OPTIONS* — ${origin} → ${destination}\n\n⚠️ Train information temporarily unavailable. Please try again later.`,
          };
        }

        return {
          success: true,
          data: `🚆 *TRAIN OPTIONS* — ${origin} → ${destination}\n👥 ${people} People | 💰 Budget: ₹${budget}\n\n${response}`,
        };
      }
    );

    if (result.fromCache) {
      logger.info('📦 Train options served from cache', {
        origin,
        destination,
        cacheKey,
      });
    }

    return result.data.success ? result.data.data : result.data.message;

  } catch (err) {
    logger.error('❌ Train service error', {
      origin,
      destination,
      error: err.message,
    });
    return `🚆 *TRAIN OPTIONS* — ${origin} → ${destination}\n\n⚠️ Train service unavailable. Please try again.`;
  }
}

// FLIGHT SERVICE - Check distance rules first (with caching)
async function getFlightOptions(origin, destination, budget, people) {
  try {
    // Check if flights are available for this route (don't cache this check)
    if (!distanceRules.isFlightAvailable(origin, destination)) {
      return `✈️ *FLIGHT OPTIONS* — ${origin} → ${destination}\n\n✈️ Flights are not available between these cities.\n\n💡 For short distances, consider Bus or Train.`;
    }

    const cacheKey = cacheManager.generateTransportKey(origin, destination, 'flight');

    const result = await cacheManager.cachedCall(
      cacheKey,
      cacheManager.TTL_CONFIG.TRANSPORT,
      async () => {
        const prompt = `Indian flight options.

Route: ${origin} to ${destination}
Budget: ₹${budget} total for ${people} people

Generate EXACTLY 4 flights from:\nIndiGo, Air India, Vistara, SpiceJet, Akasa Air

Format for each:
✈️ *Airline - Flight Number*
⏰ Depart: HH:MM
🏁 Arrive: HH:MM
⌛ Duration: Xh Ym
💰 Price: ₹XXX

Rules:
- EXACTLY 4 flights
- Different airlines
- Realistic flight numbers
- No explanations
- Clean WhatsApp format only

Return ONLY the list.`;

        const response = await generateGeminiResponse(prompt);
        
        if (!response) {
          return {
            success: false,
            message: `✈️ *FLIGHT OPTIONS* — ${origin} → ${destination}\n\n⚠️ Flight information temporarily unavailable. Please try again later.`,
          };
        }

        return {
          success: true,
          data: `✈️ *FLIGHT OPTIONS* — ${origin} → ${destination}\n👥 ${people} People | 💰 Budget: ₹${budget}\n\n${response}`,
        };
      }
    );

    if (result.fromCache) {
      logger.info('📦 Flight options served from cache', {
        origin,
        destination,
        cacheKey,
      });
    }

    return result.data.success ? result.data.data : result.data.message;

  } catch (err) {
    logger.error('❌ Flight service error', {
      origin,
      destination,
      error: err.message,
    });
    return `✈️ *FLIGHT OPTIONS* — ${origin} → ${destination}\n\n⚠️ Flight service unavailable. Please try again.`;
  }
}

/**
 * Append booking links to transport options
 */
function appendTransportBookingLinks(transportMessage, source, destination, date = new Date()) {
  try {
    // Generate booking links
    const flightLink = bookingService.generateMMTFlightLink(source, destination, date);
    const trainLink = bookingService.generateIRCTCLink(source, destination, date);
    const busLink = bookingService.generateRedBusLink(source, destination, date);

    // Append booking links
    let message = transportMessage;
    message += `\n\n━━━━━━━━━━━━━━━━\n`;
    message += `🔗 *BOOK YOUR TICKETS:*\n\n`;
    
    if (flightLink) {
      message += `✈️ Book flights (MakeMyTrip):\n${flightLink}\n\n`;
    }
    
    if (trainLink) {
      message += `🚂 Book trains (IRCTC):\n${trainLink}\n\n`;
    }
    
    if (busLink) {
      message += `🚌 Book bus (RedBus):\n${busLink}`;
    }

    message += `\n\n💡 Book through these links to support us!`;

    return message;

  } catch (error) {
    logger.error('Failed to append transport booking links', {
      error: error.message,
    });
    return transportMessage; // Return original message on error
  }
}

module.exports = {
  getBusOptions,
  getTrainOptions,
  getFlightOptions,
  appendTransportBookingLinks,
};
