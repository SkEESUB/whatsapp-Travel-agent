// Formatter - WhatsApp-friendly output formatting
// Enforces: max 4 options, clean spacing, no long paragraphs

const MAX_OPTIONS = 4;
const MAX_LINE_LENGTH = 60;

// Format transport options for WhatsApp
function formatTransportOptions(mode, origin, destination, budget, people, options) {
  let output = `🚌 *${mode} Options*\n`;
  output += `${origin} → ${destination}\n\n`;
  output += `💰 Budget: ₹${budget} (${people} people)\n\n`;

  options.slice(0, MAX_OPTIONS).forEach((opt, idx) => {
    output += `${idx + 1}️⃣ ${opt.operator || opt.name}\n`;
    if (opt.depart) output += `Depart: ${opt.depart}\n`;
    if (opt.arrive) output += `Arrive: ${opt.arrive}\n`;
    if (opt.duration) output += `Duration: ${opt.duration}\n`;
    if (opt.price) output += `Price: ₹${opt.price}\n`;
    if (opt.type) output += `Type: ${opt.type}\n`;
    if (opt.classes) output += `Classes: ${opt.classes}\n`;
    output += '\n';
  });

  return output.trim();
}

// Format hotel recommendations
function formatHotels(destination, budget, nights, hotels) {
  let output = `🏨 *Hotels in ${destination}*\n\n`;
  output += `💰 Budget: ₹${budget}\n`;
  output += `📅 ${nights} night(s)\n\n`;

  if (hotels.budget?.length) {
    output += `*Budget Hotels*\n`;
    hotels.budget.slice(0, 2).forEach(h => {
      output += `• ${h.name} – ₹${h.price} – ${h.area}\n`;
    });
    output += '\n';
  }

  if (hotels.midRange?.length) {
    output += `*Mid-Range*\n`;
    hotels.midRange.slice(0, 2).forEach(h => {
      output += `• ${h.name} – ₹${h.price} – ${h.area}\n`;
    });
    output += '\n';
  }

  if (hotels.premium?.length) {
    output += `*Premium*\n`;
    hotels.premium.slice(0, 1).forEach(h => {
      output += `• ${h.name} – ₹${h.price} – ${h.area}\n`;
    });
  }

  return output.trim();
}

// Format tourist places
function formatTouristPlaces(destination, places) {
  let output = `🎯 *Top Places in ${destination}*\n\n`;
  output += `*Must Visit*\n\n`;

  places.slice(0, 6).forEach((place, idx) => {
    output += `${idx + 1}️⃣ ${place.name}\n`;
    if (place.description) output += `${place.description}\n`;
    if (place.bestTime) output += `Best: ${place.bestTime}\n`;
    output += '\n';
  });

  return output.trim();
}

// Format itinerary
function formatItinerary(destination, days, dailyPlan) {
  let output = `📅 *${days}-Day Itinerary: ${destination}*\n\n`;

  dailyPlan.slice(0, days).forEach((day, idx) => {
    output += `*Day ${idx + 1}*\n`;
    if (day.morning) output += `🌅 Morning: ${day.morning}\n`;
    if (day.afternoon) output += `🍽️ Afternoon: ${day.afternoon}\n`;
    if (day.evening) output += `🌆 Evening: ${day.evening}\n`;
    output += '\n';
  });

  return output.trim();
}

// Format budget breakdown
function formatBudget(destination, totalBudget, people, days, breakdown) {
  let output = `💰 *Budget Plan: ${destination}*\n\n`;
  output += `Total: ₹${totalBudget} (${people} people, ${days} days)\n\n`;
  output += `*Breakdown*\n\n`;

  if (breakdown.transport) output += `🚍 Transport: ₹${breakdown.transport}\n`;
  if (breakdown.hotel) output += `🏨 Hotel: ₹${breakdown.hotel}\n`;
  if (breakdown.food) output += `🍽️ Food: ₹${breakdown.food}\n`;
  if (breakdown.localTravel) output += `🛺 Local Travel: ₹${breakdown.localTravel}\n`;
  if (breakdown.emergencyBuffer) output += `🚨 Emergency: ₹${breakdown.emergencyBuffer}\n`;

  return output.trim();
}

// Truncate long text
function truncate(text, maxLength = 500) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

module.exports = {
  formatTransportOptions,
  formatHotels,
  formatTouristPlaces,
  formatItinerary,
  formatBudget,
  truncate,
  MAX_OPTIONS,
};
