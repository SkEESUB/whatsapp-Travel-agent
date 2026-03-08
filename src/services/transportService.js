// Transport Service - Generates structured transport options
// Enforces: EXACTLY 4 options, no repetition, clean format

const { GoogleGenerativeAI } = require("@google/generative-ai");
const formatter = require("../utils/formatter");
const distanceRules = require("../utils/distanceRules");

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
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  });
}

async function generateGeminiResponse(prompt) {
  try {
    console.log("🤖 Gemini: Generating response...");
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    console.log("✅ Gemini: Response generated successfully");
    return text;
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
    return null;
  }
}

// BUS SERVICE - Generate exactly 4 bus options
async function getBusOptions(origin, destination, budget, people) {
  const prompt = `Indian bus options.

Route: ${origin} to ${destination}
Budget: ₹${budget} total for ${people} people

Generate EXACTLY 4 different bus types:
1️⃣ AC Sleeper
2️⃣ Volvo Multi-Axle
3️⃣ Non-AC Sleeper  
4️⃣ AC Seater

Format for each:
Operator Name
Depart: HH:MM
Arrive: HH:MM
Duration: Xh Ym
Price: ₹XXX
Type: Bus type

Rules:
- EXACTLY 4 options
- Different bus types
- Real Indian operators (APSRTC, Orange Travels, VRL, SRS)
- No explanations
- Clean format only

Return ONLY the list.`;

  const response = await generateGeminiResponse(prompt);
  
  if (!response) {
    return null;
  }
  
  return formatter.formatTransportOptions('Bus', origin, destination, budget, people, parseBusResponse(response));
}

// TRAIN SERVICE - Generate train options with names and numbers
async function getTrainOptions(origin, destination, budget, people) {
  const prompt = `Indian Railways train options.

Route: ${origin} to ${destination}
Budget: ₹${budget} total for ${people} people

Generate EXACTLY 4 trains with:
Train Number + Name (e.g., "12722 Dakshin Express")
Depart: HH:MM
Arrive: HH:MM
Duration: Xh Ym
Classes: SL / 3A / 2A
Price: ₹XXX–₹XXX

Rules:
- EXACTLY 4 trains
- Include train numbers
- Real train names
- No explanations
- Clean format only

Return ONLY the list.`;

  const response = await generateGeminiResponse(prompt);
  
  if (!response) {
    return null;
  }
  
  return formatter.formatTransportOptions('Train', origin, destination, budget, people, parseTrainResponse(response));
}

// FLIGHT SERVICE - Check distance rules first
async function getFlightOptions(origin, destination, budget, people) {
  // Check if flights are available for this route
  if (!distanceRules.isFlightAvailable(origin, destination)) {
    return {
      message: "✈️ Flights are not available between these cities.\n\nFor short distances, consider Bus or Train."
    };
  }

  const prompt = `Indian flight options.

Route: ${origin} to ${destination}
Budget: ₹${budget} total for ${people} people

Generate EXACTLY 4 flights from:
IndiGo, Air India, Vistara, SpiceJet, Akasa Air

Format for each:
Airline + Flight Number (e.g., "IndiGo 6E 213")
Depart: HH:MM
Arrive: HH:MM
Duration: Xh Ym
Price: ₹XXX

Rules:
- EXACTLY 4 flights
- Different airlines
- Realistic flight numbers
- No explanations
- Clean format only

Return ONLY the list.`;

  const response = await generateGeminiResponse(prompt);
  
  if (!response) {
    return null;
  }
  
  return formatter.formatTransportOptions('Flight', origin, destination, budget, people, parseFlightResponse(response));
}

// Parse Gemini response into structured data
function parseBusResponse(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const options = [];
  let current = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+️⃣/.test(trimmed) || trimmed.match(/^\d+\./)) {
      if (Object.keys(current).length > 0) {
        options.push(current);
      }
      current = { name: trimmed.replace(/^[0-9]+[️⃣\.]\s*/, '') };
    } else if (trimmed.startsWith('Depart:')) {
      current.depart = trimmed.replace('Depart:', '').trim();
    } else if (trimmed.startsWith('Arrive:')) {
      current.arrive = trimmed.replace('Arrive:', '').trim();
    } else if (trimmed.startsWith('Duration:')) {
      current.duration = trimmed.replace('Duration:', '').trim();
    } else if (trimmed.startsWith('Price:')) {
      current.price = trimmed.replace('Price:', '').replace('₹', '').trim();
    } else if (trimmed.startsWith('Type:') || trimmed.startsWith('Operator')) {
      current.operator = trimmed.replace(/^(Type:|Operator)/, '').replace(':', '').trim();
    }
  }
  
  if (Object.keys(current).length > 0) {
    options.push(current);
  }
  
  return options.slice(0, formatter.MAX_OPTIONS);
}

function parseTrainResponse(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const options = [];
  let current = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+️⃣/.test(trimmed) || trimmed.match(/^\d+\./)) {
      if (Object.keys(current).length > 0) {
        options.push(current);
      }
      current = { name: trimmed.replace(/^[0-9]+[️⃣\.]\s*/, '') };
    } else if (trimmed.startsWith('Depart:')) {
      current.depart = trimmed.replace('Depart:', '').trim();
    } else if (trimmed.startsWith('Arrive:')) {
      current.arrive = trimmed.replace('Arrive:', '').trim();
    } else if (trimmed.startsWith('Duration:')) {
      current.duration = trimmed.replace('Duration:', '').trim();
    } else if (trimmed.startsWith('Classes:')) {
      current.classes = trimmed.replace('Classes:', '').trim();
    } else if (trimmed.startsWith('Price:')) {
      current.price = trimmed.replace('Price:', '').trim();
    }
  }
  
  if (Object.keys(current).length > 0) {
    options.push(current);
  }
  
  return options.slice(0, formatter.MAX_OPTIONS);
}

function parseFlightResponse(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const options = [];
  let current = {};
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+️⃣/.test(trimmed) || trimmed.match(/^\d+\./)) {
      if (Object.keys(current).length > 0) {
        options.push(current);
      }
      current = { name: trimmed.replace(/^[0-9]+[️⃣\.]\s*/, '') };
    } else if (trimmed.startsWith('Depart:')) {
      current.depart = trimmed.replace('Depart:', '').trim();
    } else if (trimmed.startsWith('Arrive:')) {
      current.arrive = trimmed.replace('Arrive:', '').trim();
    } else if (trimmed.startsWith('Duration:')) {
      current.duration = trimmed.replace('Duration:', '').trim();
    } else if (trimmed.startsWith('Price:')) {
      current.price = trimmed.replace('Price:', '').replace('₹', '').trim();
    }
  }
  
  if (Object.keys(current).length > 0) {
    options.push(current);
  }
  
  return options.slice(0, formatter.MAX_OPTIONS);
}

module.exports = {
  getBusOptions,
  getTrainOptions,
  getFlightOptions,
};
