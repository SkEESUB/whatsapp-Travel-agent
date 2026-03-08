// Budget Service - Generate structured budget breakdown
const { GoogleGenerativeAI } = require("@google/generative-ai");
const formatter = require("../utils/formatter");

let genAI = null;

function initializeGemini() {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) return null;
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

function getGeminiModel() {
  const ai = initializeGemini();
  if (!ai) throw new Error("Gemini AI not initialized");
  return ai.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
}

async function generateGeminiResponse(prompt) {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    return (await result.response).text().trim();
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
    return null;
  }
}

async function getBudgetPlan(destination, totalBudget, people, days) {
  const prompt = `Budget breakdown for ${destination} trip.

Total: ₹${totalBudget}, People: ${people}, Days: ${days}

Generate breakdown:
Transport: ₹XXXX
Hotel: ₹XXXX
Food: ₹XXXX
Local Travel: ₹XXXX
Emergency: ₹XXXX

Rules:
- Realistic amounts
- Must add up to total
- No explanations
- Clean format

Return ONLY the list.`;

  const response = await generateGeminiResponse(prompt);
  
  if (!response) {
    // Fallback to logic-based breakdown
    return formatter.formatBudget(destination, totalBudget, people, days, {
      transport: Math.floor(totalBudget * 0.3),
      hotel: Math.floor(totalBudget * 0.4),
      food: Math.floor(totalBudget * 0.2),
      localTravel: Math.floor(totalBudget * 0.05),
      emergencyBuffer: Math.floor(totalBudget * 0.05),
    });
  }

  const breakdown = parseBudgetResponse(response, totalBudget);
  return formatter.formatBudget(destination, totalBudget, people, days, breakdown);
}

function parseBudgetResponse(text, totalBudget) {
  const breakdown = {};
  const lines = text.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (/transport/i.test(trimmed)) {
      breakdown.transport = extractAmount(trimmed);
    } else if (/hotel|accommodation/i.test(trimmed)) {
      breakdown.hotel = extractAmount(trimmed);
    } else if (/food|meal/i.test(trimmed)) {
      breakdown.food = extractAmount(trimmed);
    } else if (/local travel|local transport/i.test(trimmed)) {
      breakdown.localTravel = extractAmount(trimmed);
    } else if (/emergency|buffer/i.test(trimmed)) {
      breakdown.emergencyBuffer = extractAmount(trimmed);
    }
  }
  
  // Ensure all categories exist
  if (!breakdown.transport) breakdown.transport = Math.floor(totalBudget * 0.3);
  if (!breakdown.hotel) breakdown.hotel = Math.floor(totalBudget * 0.4);
  if (!breakdown.food) breakdown.food = Math.floor(totalBudget * 0.2);
  if (!breakdown.localTravel) breakdown.localTravel = Math.floor(totalBudget * 0.05);
  if (!breakdown.emergencyBuffer) breakdown.emergencyBuffer = Math.floor(totalBudget * 0.05);
  
  return breakdown;
}

function extractAmount(text) {
  const match = text.match(/₹?\s*(\d+)/i);
  return match ? parseInt(match[1]) : 0;
}

module.exports = { getBudgetPlan };
