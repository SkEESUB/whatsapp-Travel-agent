// Hotel Service - Generate structured hotel recommendations
const { GoogleGenerativeAI } = require("@google/generative-ai");
const formatter = require("../utils/formatter");

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
    console.error("❌ Gemini API error:", err.message);
    return null;
  }
}

async function getHotels(destination, hotelBudget, days) {
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
    return formatter.formatHotels(destination, hotelBudget, totalNights, {
      budget: [{ name: 'Budget Hotel', price: perNight, area: 'City Center' }],
      midRange: [{ name: 'Mid-Range Hotel', price: perNight * 1.5, area: 'Main Area' }],
      premium: []
    });
  }

  const hotels = parseHotelResponse(response);
  return formatter.formatHotels(destination, hotelBudget, totalNights, hotels);
}

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

module.exports = { getHotels };
