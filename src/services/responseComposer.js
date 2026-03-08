/**
 * Response Composer Service
 * Formats travel information into clean WhatsApp-friendly messages
 * Uses minimal emojis, clear sections, no marketing tone
 */

/**
 * Composes a complete travel response message
 * @param {Object} data - Travel data to format
 * @param {Object} data.travelOptions - Travel comparison options
 * @param {Object} data.budgetBreakdown - Budget allocation breakdown
 * @param {Object} data.itinerary - Generated itinerary
 * @returns {string} Formatted WhatsApp message
 */
function composeResponse(data) {
  if (!data || typeof data !== 'object') {
    return 'Sorry, unable to generate response. Please try again.';
  }

  const sections = [];

  // Add header
  sections.push(composeHeader(data.destination, data.days));

  // Add travel options section
  if (data.travelOptions) {
    sections.push(composeTravelOptions(data.travelOptions));
  }

  // Add budget breakdown section
  if (data.budgetBreakdown) {
    sections.push(composeBudgetBreakdown(data.budgetBreakdown));
  }

  // Add itinerary section
  if (data.itinerary) {
    sections.push(composeItinerary(data.itinerary));
  }

  // Add footer
  sections.push(composeFooter());

  // Join sections with double newlines
  return sections.filter(Boolean).join('\n\n');
}

/**
 * Composes message header
 * @param {string} destination - Trip destination
 * @param {number} days - Number of days
 * @returns {string} Header section
 */
function composeHeader(destination, days) {
  if (!destination) return '';
  
  return `*Trip to ${destination}*\n${days} days`;
}

/**
 * Composes travel options section
 * @param {Object} options - Travel options from comparison service
 * @returns {string} Travel options section
 */
function composeTravelOptions(options) {
  if (!options || typeof options !== 'object') return '';

  const lines = ['*Travel Options*'];

  const transportTypes = ['train', 'bus', 'flight'];
  
  for (const type of transportTypes) {
    const option = options[type];
    if (!option) continue;

    const preferred = option.isPreferred ? ' (preferred)' : '';
    lines.push(`\n${capitalize(type)}${preferred}:`);
    
    if (option.estimatedCostRange?.roundTrip) {
      const cost = option.estimatedCostRange.roundTrip;
      lines.push(`  Cost: ₹${cost.min} - ₹${cost.max}`);
    }
    
    if (option.estimatedDuration?.roundTrip) {
      lines.push(`  Duration: ${option.estimatedDuration.roundTrip}`);
    }
    
    if (option.notes) {
      lines.push(`  Note: ${option.notes}`);
    }
  }

  if (options.train?.disclaimer) {
    lines.push(`\n_${options.train.disclaimer}_`);
  }

  return lines.join('\n');
}

/**
 * Composes budget breakdown section
 * @param {Object} breakdown - Budget breakdown object
 * @returns {string} Budget section
 */
function composeBudgetBreakdown(breakdown) {
  if (!breakdown || !breakdown.breakdown) return '';

  const lines = ['*Budget Breakdown*'];
  const b = breakdown.breakdown;

  // Transport
  if (b.transport) {
    lines.push(`\nTransport: ₹${b.transport.amount} (${b.transport.percentage}%)`);
    if (b.transport.note) lines.push(`  ${b.transport.note}`);
  }

  // Stay
  if (b.stay) {
    lines.push(`\nStay: ₹${b.stay.amount} (${b.stay.percentage}%)`);
    lines.push(`  ~₹${b.stay.daily} per night`);
  }

  // Food
  if (b.food) {
    lines.push(`\nFood: ₹${b.food.amount} (${b.food.percentage}%)`);
    lines.push(`  ~₹${b.food.daily} per day`);
  }

  // Local Travel
  if (b.localTravel) {
    lines.push(`\nLocal Travel: ₹${b.localTravel.amount} (${b.localTravel.percentage}%)`);
    lines.push(`  ~₹${b.localTravel.daily} per day`);
  }

  // Buffer
  if (b.buffer) {
    lines.push(`\nBuffer: ₹${b.buffer.amount} (${b.buffer.percentage}%)`);
    if (b.buffer.note) lines.push(`  ${b.buffer.note}`);
  }

  // Summary
  if (breakdown.summary) {
    lines.push(`\nTotal: ₹${breakdown.totalBudget}`);
    lines.push(`Daily average: ₹${breakdown.summary.dailyAverage}`);
  }

  if (breakdown.disclaimer) {
    lines.push(`\n_${breakdown.disclaimer}_`);
  }

  return lines.join('\n');
}

/**
 * Composes itinerary section
 * @param {Object} itineraryData - Itinerary data
 * @returns {string} Itinerary section
 */
function composeItinerary(itineraryData) {
  if (!itineraryData || !itineraryData.itinerary) return '';

  const lines = ['*Suggested Itinerary*'];

  for (const day of itineraryData.itinerary) {
    lines.push('');
    lines.push(`*Day ${day.day}*${day.theme ? `: ${day.theme}` : ''}`);
    
    if (day.places && day.places.length > 0) {
      lines.push(`Places: ${day.places.join(', ')}`);
    }
    
    if (day.food) {
      lines.push(`Food: ${day.food}`);
    }
    
    if (day.notes) {
      lines.push(`Note: ${day.notes}`);
    }
  }

  if (itineraryData.generalTips && itineraryData.generalTips.length > 0) {
    lines.push('\n*Tips:*');
    for (const tip of itineraryData.generalTips) {
      lines.push(`• ${tip}`);
    }
  }

  if (itineraryData.disclaimer) {
    lines.push(`\n_${itineraryData.disclaimer}_`);
  }

  return lines.join('\n');
}

/**
 * Composes message footer
 * @returns {string} Footer section
 */
function composeFooter() {
  return `---
Reply "new trip" to plan another journey.`;
}

/**
 * Composes a simple text response (for questions/clarifications)
 * @param {string} text - Text to format
 * @returns {string} Formatted message
 */
function composeSimpleResponse(text) {
  if (!text || typeof text !== 'string') return '';
  return text.trim();
}

/**
 * Composes a clarification question
 * @param {string} question - Question to ask
 * @param {Object} currentState - Current trip state
 * @returns {string} Formatted question
 */
function composeClarificationQuestion(question, currentState) {
  if (!question) return '';

  const lines = [question];

  // Optionally show progress
  if (currentState && typeof currentState === 'object') {
    const filledFields = Object.entries(currentState)
      .filter(([key, value]) => value !== null && value !== undefined)
      .map(([key]) => key);
    
    if (filledFields.length > 0) {
      lines.push(`\n(Received: ${filledFields.join(', ')})`);
    }
  }

  return lines.join('');
}

/**
 * Capitalizes first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  if (!str || typeof str !== 'string') return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  composeResponse,
  composeHeader,
  composeTravelOptions,
  composeBudgetBreakdown,
  composeItinerary,
  composeSimpleResponse,
  composeClarificationQuestion
};
