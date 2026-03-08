const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

/**
 * Extract trip details from free text
 * @param {string} text - User input text
 * @returns {Object|null} - {destination, days, budget, people} or null
 */
async function extractTripDetails(text) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `Extract trip details from the user's message. Return ONLY a JSON object with these fields: destination (string), days (number), budget (number), people (number). If any field is missing or unclear, return null. Do not include explanations.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_tokens: 100,
      temperature: 0,
    });

    const content = response.choices[0].message.content.trim();

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(content);

      // Validate required fields
      if (
        parsed.destination &&
        typeof parsed.days === "number" &&
        typeof parsed.budget === "number" &&
        typeof parsed.people === "number"
      ) {
        return {
          destination: parsed.destination,
          days: parsed.days,
          budget: parsed.budget,
          people: parsed.people,
        };
      }

      return null;
    } catch {
      return null;
    }
  } catch (error) {
    console.error("OpenAI extractTripDetails error:", error.message);
    return null;
  }
}

/**
 * Generate a short WhatsApp-friendly day-wise itinerary
 * @param {string} destination - Trip destination
 * @param {number} days - Number of days
 * @returns {string} - Formatted itinerary (max 300 chars)
 */
async function generateItinerary(destination, days) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `Generate a short ${days}-day itinerary for ${destination}. Format for WhatsApp with emojis. Keep under 300 characters. Use bullet points for each day.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI generateItinerary error:", error.message);
    return `📅 ${days} days in ${destination}\n\n• Day 1: Explore local attractions\n• Day 2: Try local cuisine\n• Day 3: Visit popular spots\n\nType *Hotels* or *Transport* for more info.`;
  }
}

/**
 * Smart fallback for unmatched user input
 * @param {string} text - User message
 * @returns {string} - Friendly response explaining bot capabilities
 */
async function smartFallback(text) {
  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are a friendly travel assistant. The user seems confused. Briefly explain what this bot can do:
- Plan trips by sending details like "Goa, 4 days, 20000, 2 people"
- Type "Hotels" to find accommodation
- Type "Transport" for travel options
- Type "Itinerary" for day plans
- Type "help" for all commands

Keep response under 200 characters, friendly, with emojis.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI smartFallback error:", error.message);
    return "🤖 I'm here to help you plan trips!\n\nSend details like:\n*Goa, 4 days, 20000, 2 people*\n\nOr type *help* for commands.";
  }
}

module.exports = {
  extractTripDetails,
  generateItinerary,
  smartFallback,
};
