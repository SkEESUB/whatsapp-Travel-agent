/**
 * Itinerary Generator Service
 * Generates day-wise travel itineraries using OpenAI API
 * AI generates place names, food suggestions, and simple day plans
 * NO prices, NO timings, NO assumptions
 */

const OpenAI = require('openai');

// Lazy initialization of OpenAI client
let openai = null;

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

/**
 * Generates an itinerary for the given destination and duration
 * @param {string} destination - Destination city/location
 * @param {number} days - Number of days for the trip
 * @param {Object} preferences - Optional user preferences
 * @param {string} [preferences.interests] - User interests (e.g., 'history, food, nature')
 * @param {string} [preferences.pace] - Preferred pace ('relaxed', 'moderate', 'fast')
 * @returns {Object} Structured itinerary with day-wise plan
 */
async function generateItinerary(destination, days, preferences = {}) {
  // Validate inputs
  if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
    throw new Error('Invalid destination: must be a non-empty string');
  }

  if (typeof days !== 'number' || days <= 0 || days > 14 || !Number.isInteger(days)) {
    throw new Error('Invalid days: must be a positive integer between 1 and 14');
  }

  const cleanDestination = destination.trim();
  const pace = preferences.pace || 'moderate';
  const interests = preferences.interests || 'general sightseeing';

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a helpful travel itinerary assistant. 
Create a ${days}-day itinerary for ${cleanDestination}.

STRICT RULES:
- Suggest specific place names (monuments, markets, neighborhoods, viewpoints)
- Suggest food items or restaurant types (NO specific restaurant names with prices)
- Create a simple day-wise plan
- NO specific prices or costs
- NO specific timings or schedules
- NO assumptions about user preferences beyond what is provided
- Keep descriptions brief and practical

Output must be valid JSON in this exact format:
{
  "destination": "${cleanDestination}",
  "days": ${days},
  "itinerary": [
    {
      "day": 1,
      "theme": "brief theme for the day",
      "places": ["place 1", "place 2", "place 3"],
      "food": "food suggestions for the day",
      "notes": "brief practical notes"
    }
  ],
  "generalTips": ["tip 1", "tip 2"]
}`
        },
        {
          role: 'user',
          content: `Create a ${days}-day itinerary for ${cleanDestination}.
Pace: ${pace}
Interests: ${interests}

Return only the JSON object, no additional text.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    // Parse the AI response
    const content = response.choices[0].message.content;
    const itinerary = parseItineraryResponse(content);

    return {
      success: true,
      destination: cleanDestination,
      days,
      preferences: {
        pace,
        interests
      },
      itinerary: itinerary.itinerary,
      generalTips: itinerary.generalTips || [],
      disclaimer: 'This itinerary is AI-generated. Please verify opening hours and availability before visiting.'
    };

  } catch (error) {
    console.error('Error generating itinerary:', error.message);
    
    // Return fallback itinerary if AI fails or API key is missing
    return {
      success: false,
      destination: cleanDestination,
      days,
      error: error.message,
      itinerary: generateFallbackItinerary(cleanDestination, days),
      disclaimer: 'Unable to generate detailed itinerary. Basic template provided.'
    };
  }
}

/**
 * Parses the AI response into structured format
 * @param {string} content - Raw AI response
 * @returns {Object} Parsed itinerary
 */
function parseItineraryResponse(content) {
  try {
    // Try to parse as JSON directly
    return JSON.parse(content);
  } catch (parseError) {
    // If direct parsing fails, try to extract JSON from markdown
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                      content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse extracted JSON:', e);
      }
    }
    
    throw new Error('Unable to parse AI response as JSON');
  }
}

/**
 * Generates a fallback itinerary when AI is unavailable
 * @param {string} destination - Destination
 * @param {number} days - Number of days
 * @returns {Object[]} Basic itinerary structure
 */
function generateFallbackItinerary(destination, days) {
  const itinerary = [];

  for (let i = 1; i <= days; i++) {
    itinerary.push({
      day: i,
      theme: `Day ${i} in ${destination}`,
      places: ['Local attractions', 'Markets or shopping areas', 'Scenic spots'],
      food: 'Try local cuisine and street food',
      notes: 'Explore at your own pace'
    });
  }

  return itinerary;
}

/**
 * Validates the generated itinerary structure
 * @param {Object} itinerary - Itinerary object to validate
 * @returns {boolean} True if valid
 */
function validateItinerary(itinerary) {
  if (!itinerary || typeof itinerary !== 'object') {
    return false;
  }

  if (!Array.isArray(itinerary.itinerary)) {
    return false;
  }

  for (const day of itinerary.itinerary) {
    if (!day.day || !Array.isArray(day.places)) {
      return false;
    }
  }

  return true;
}

module.exports = {
  generateItinerary,
  generateFallbackItinerary,
  validateItinerary
};
