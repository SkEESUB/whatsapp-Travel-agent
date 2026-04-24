// Hotel Service - Generate structured hotel recommendations with caching
const { GoogleGenerativeAI } = require("@google/generative-ai");
const cacheManager = require('../cache/cacheManager');
const bookingService = require('./bookingService');
const logger = require('../config/logger');

let genAI = null;

function initializeGemini() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY is NOT loaded from .env");
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

async function getHotels(destination, hotelBudget, days) {
  try {
    // Generate cache key
    const cacheKey = cacheManager.generateHotelKey(destination, hotelBudget, 1);

    // Use cache-through pattern
    const result = await cacheManager.cachedCall(
      cacheKey,
      cacheManager.TTL_CONFIG.HOTELS,
      async () => {
        // This function only runs on cache miss
        const totalNights = days > 1 ? days - 1 : 1;
        const perNight = Math.floor(hotelBudget / totalNights);

        const prompt = `Hotels in ${destination}, India.

Budget: ₹${hotelBudget} for ${totalNights} nights (~₹${perNight}/night)

Generate EXACTLY:
- 2 Budget hotels (₹1500-₹3000)
- 2 Mid-range hotels (₹3500-₹6000)
- 1 Premium hotel (₹7000+)

Format each:
Hotel Name – ₹Price – Area

Rules:
- Real hotel names
- Real areas
- No explanations
- Clean format only

Return ONLY the list.`;

        const response = await generateGeminiResponse(prompt);
        
        if (!response) {
          return {
            success: false,
            message: "⚠️ Hotel information temporarily unavailable. Please try again later.",
          };
        }

        return {
          success: true,
          data: response,
        };
      }
    );

    // Return cached or fresh data
    if (result.fromCache) {
      logger.info('📦 Hotels served from cache', {
        destination,
        cacheKey,
      });
    }

    if (result.data.success) {
      return result.data.data; // Return the actual hotel text
    }

    return result.data.message;

  } catch (error) {
    logger.error('Hotels service error', {
      destination,
      error: error.message,
    });
    return "⚠️ Hotel information temporarily unavailable. Please try again later.";
  }
}

// Parse Gemini response into structured hotel data
function parseHotelResponse(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const hotels = { budget: [], midRange: [], premium: [] };
  
  let category = 'budget';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().includes('budget')) category = 'budget';
    else if (trimmed.toLowerCase().includes('mid') || trimmed.toLowerCase().includes('medium')) category = 'midRange';
    else if (trimmed.toLowerCase().includes('premium') || trimmed.toLowerCase().includes('luxury')) category = 'premium';
    
    if (trimmed.includes('–') || trimmed.includes('-')) {
      const parts = trimmed.split(/[–-]/).map(p => p.trim());
      if (parts.length >= 3) {
        const hotel = {
          name: parts[0].replace(/^[•\-\d]\s*/, ''),
          price: parts[1].replace('₹', '').trim(),
          area: parts[2]
        };
        
        if (category === 'budget' && hotels.budget.length < 2) {
          hotels.budget.push(hotel);
        } else if (category === 'midRange' && hotels.midRange.length < 2) {
          hotels.midRange.push(hotel);
        } else if (category === 'premium' && hotels.premium.length < 1) {
          hotels.premium.push(hotel);
        }
      }
    }
  }
  
  return hotels;
}

/**
 * Append booking links to hotel recommendations
 */
function appendHotelBookingLinks(hotelMessage, destination, days = 3, options = {}) {
  try {
    const { checkin = new Date(), checkout = null } = options;
    
    // Calculate checkout date if not provided
    const checkoutDate = checkout || new Date(new Date(checkin).getTime() + days * 24 * 60 * 60 * 1000);

    // Generate booking links
    const mmtLink = bookingService.generateMMTHotelLink(destination, checkin, checkoutDate);
    const bookingComLink = bookingService.generateBookingComLink(destination, checkin, checkoutDate);

    // Append booking links
    let message = hotelMessage;
    message += `\n\n━━━━━━━━━━━━━━━━\n`;
    message += `🔗 *BOOK YOUR STAY:*\n\n`;
    
    if (mmtLink) {
      message += `🏨 Book on MakeMyTrip:\n${mmtLink}\n\n`;
    }
    
    if (bookingComLink) {
      message += `🌍 Compare prices on Booking.com:\n${bookingComLink}`;
    }

    message += `\n\n💡 Book through these links to support us!`;

    return message;

  } catch (error) {
    logger.error('Failed to append hotel booking links', {
      error: error.message,
    });
    return hotelMessage; // Return original message on error
  }
}

module.exports = { getHotels, appendHotelBookingLinks };
