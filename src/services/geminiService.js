const axios = require("axios");

// Input sanitization utility
function sanitizeInput(text) {
  if (!text) return '';
  return String(text)
    .replace(/[;<>"']/g, '')  // Remove dangerous chars
    .substring(0, 100);       // Limit length
}


// Gemini API call
async function generateAIResponse(prompt) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log("🤖 Gemini: Generating response...");

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    const text =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (!text) {
      console.warn("⚠️ [Gemini] Returned empty response");
      return "⚠️ Travel information temporarily unavailable. Please try again later.";
    }

    console.log("✅ [Gemini] Response generated successfully");
    return text;

  } catch (error) {
    console.error("❌ Gemini API error:", error.response?.data || error.message);
    return null;
  }
}



// Transport options (Bus / Train / Flight)
async function getTransportOptions(origin, destination, mode, budget, people) {

  const prompt = `
User travelling in India.

Route: ${origin} → ${destination}
Transport: ${mode}
People: ${people}
Budget: ₹${budget}

Generate 4 realistic ${mode} options.

Return EXACTLY in this format:

1️⃣ Operator | Departure | Arrival | Duration | Price

Example:
APSRTC | 08:30 PM | 03:00 AM | 6h 30m | ₹620

Rules:
- Only 4 rows
- No explanation
- No paragraphs
`;

  const response = await generateGeminiResponse(prompt);

  if (!response) return "⚠️ Unable to fetch transport data right now.";

  return `🚍 ${mode.toUpperCase()} OPTIONS
${origin} → ${destination}

👥 ${people} People
💰 Budget: ₹${budget}

Operator | Depart | Arrive | Duration | Price
------------------------------------------------
${response}`;
}



// Hotels
async function getHotelRecommendations(destination, hotelBudget, days) {

  const nights = days > 1 ? days - 1 : 1;
  const perNight = Math.floor(hotelBudget / nights);

  const prompt = `
User visiting ${destination}, India.

Hotel budget: ₹${hotelBudget}
Stay: ${nights} nights

Suggest 5 hotels.

Return EXACTLY like this:

Hotel Name | Area | Rating | Price per night

Example:
Treebo Trend | MG Road | ⭐4.2 | ₹2100

Rules:
- 5 hotels only
- No descriptions
`;

  const response = await generateGeminiResponse(prompt);

  if (!response) return "⚠️ Unable to fetch hotel data.";

  return `🏨 HOTELS IN ${destination}

📅 ${days} days (${nights} nights)
💰 Budget: ₹${hotelBudget}
💵 ~₹${perNight}/night

Hotel | Area | Rating | Price
----------------------------------------
${response}`;
}



// Tourist places
async function getTouristPlaces(destination) {

  const prompt = `
List 6 popular tourist places in ${destination}, India.

Return format:

Place | Area | Best Time

Example:
Charminar | Old City | Evening

Rules:
- 6 rows only
- No descriptions
`;

  const response = await generateGeminiResponse(prompt);

  if (!response) return "⚠️ Unable to fetch tourist places.";

  return `📍 TOP PLACES IN ${destination}

Place | Area | Best Time
-------------------------------
${response}`;
}



// Itinerary
async function getItinerary(destination, days, people, budget) {

  const dailyBudget = Math.floor(budget / days);

  const prompt = `
Create ${days} day travel plan for ${destination}, India.

Return format:

Day | Morning | Afternoon | Evening

Example:
Day 1 | Visit Red Fort | Lunch at Chandni Chowk | India Gate

Rules:
- Only ${days} rows
- No paragraphs
`;

  const response = await generateGeminiResponse(prompt);

  if (!response) return "⚠️ Unable to generate itinerary.";

  return `🗺️ ${days}-DAY PLAN FOR ${destination}

👥 ${people} People
💰 Budget ₹${budget}
📊 Daily ~₹${dailyBudget}

Day | Morning | Afternoon | Evening
-------------------------------------------
${response}`;
}



// Budget planner
async function getBudgetPlan(destination, totalBudget, people, days) {

  const prompt = `
Create travel budget for ${destination}, India.

Budget: ₹${totalBudget}
People: ${people}
Days: ${days}

Return format:

Category | Estimated Cost

Example:
Transport | ₹4000
Hotel | ₹8000
Food | ₹3000

Rules:
- 5 rows only
`;

  const response = await generateGeminiResponse(prompt);

  if (!response) return "⚠️ Unable to generate budget plan.";

  return `💰 TRIP BUDGET

Destination: ${destination}
People: ${people}
Days: ${days}
Total: ₹${totalBudget}

Category | Cost
-------------------------
${response}`;
}

module.exports = {
  generateAIResponse,
  getTransportOptions,
  getHotelRecommendations,
  getTouristPlaces,
  getItinerary,
  getBudgetPlan,
};