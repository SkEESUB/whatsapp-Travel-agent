/**
 * Message Parser Utility
 * Extracts travel information from natural language messages
 * Uses pattern matching - no AI required
 */

/**
 * Parses user message to extract travel information
 * @param {string} message - User's message text
 * @returns {Object} Extracted data fields
 */
function parseMessage(message) {
  if (!message || typeof message !== 'string') {
    return {};
  }

  const text = message.toLowerCase().trim();
  const extracted = {};

  // Extract origin and destination
  const locationPatterns = [
    // "from X to Y" or "X to Y"
    { regex: /(?:from\s+)?([a-z\s]+?)\s+to\s+([a-z\s]+)/i, fromIndex: 1, toIndex: 2 },
    // "traveling from X to Y"
    { regex: /travel(?:ing|ling)?\s+from\s+([a-z\s]+?)\s+to\s+([a-z\s]+)/i, fromIndex: 1, toIndex: 2 },
    // "trip from X to Y"
    { regex: /trip\s+from\s+([a-z\s]+?)\s+to\s+([a-z\s]+)/i, fromIndex: 1, toIndex: 2 },
    // "going to X from Y"
    { regex: /going\s+to\s+([a-z\s]+?)\s+from\s+([a-z\s]+)/i, fromIndex: 2, toIndex: 1 },
    // "visit X from Y"
    { regex: /visit\s+([a-z\s]+?)\s+from\s+([a-z\s]+)/i, fromIndex: 2, toIndex: 1 }
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      extracted.from = capitalizeWords(match[pattern.fromIndex].trim());
      extracted.to = capitalizeWords(match[pattern.toIndex].trim());
      break;
    }
  }

  // If only destination mentioned
  if (!extracted.to) {
    const destPatterns = [
      /(?:want\s+to\s+)?(?:go\s+to|visit|travel\s+to)\s+([a-z\s]{3,})/i,
      /(?:planning\s+a\s+trip\s+to)\s+([a-z\s]{3,})/i,
      /(?:trip\s+to)\s+([a-z\s]{3,})/i
    ];

    for (const pattern of destPatterns) {
      const match = text.match(pattern);
      if (match) {
        extracted.to = capitalizeWords(match[1].trim());
        break;
      }
    }
  }

  // Extract days
  const dayPatterns = [
    /(\d+)\s*days?/i,
    /for\s+(\d+)\s*days?/i,
    /(\d+)\s*day\s+trip/i,
    /trip\s+for\s+(\d+)\s*days?/i,
    /(\d+)\s*nights?/i
  ];

  for (const pattern of dayPatterns) {
    const match = text.match(pattern);
    if (match) {
      extracted.days = parseInt(match[1], 10);
      break;
    }
  }

  // Extract budget
  const budgetPatterns = [
    // Rupee symbol or Rs
    /(?:₹|rs\.?|rupees?)\s*(\d[\d,]*)/i,
    // Budget keyword
    /budget\s+(?:of\s+)?(?:₹|rs\.?)?\s*(\d[\d,]*)/i,
    // "have 50000" or "with 10000"
    /(?:have|with)\s+(?:₹|rs\.?)?\s*(\d[\d,]*)/i,
    // "around 50000" or "about 10000"
    /(?:around|about|approx)\s+(?:₹|rs\.?)?\s*(\d[\d,]*)/i,
    // Just a large number (4+ digits) likely to be budget
    /(\d{4,})/i
  ];

  for (const pattern of budgetPatterns) {
    const match = text.match(pattern);
    if (match) {
      const budgetValue = parseInt(match[1].replace(/,/g, ''), 10);
      if (budgetValue >= 1000) { // Minimum reasonable budget
        extracted.budget = budgetValue;
        break;
      }
    }
  }

  // Extract transport preference
  const transportPatterns = {
    train: ['train', 'railway', 'rail', 'by train', 'via train'],
    bus: ['bus', 'road', 'by bus', 'via bus', 'volvo'],
    flight: ['flight', 'fly', 'flying', 'airplane', 'plane', 'air', 'by flight', 'via flight']
  };

  for (const [type, keywords] of Object.entries(transportPatterns)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      extracted.transportPreference = type;
      break;
    }
  }

  // Extract dates (simple patterns)
  const datePatterns = [
    // "starting 15th Jan" or "from 15 Jan"
    /(?:starting|from|on)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i,
    // "Jan 15" or "January 15"
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i
  ];

  const dateMatch = text.match(datePatterns[0]) || text.match(datePatterns[1]);
  if (dateMatch) {
    // Store as simple string for now
    extracted.startDateHint = dateMatch[0];
  }

  return extracted;
}

/**
 * Detects message intent
 * @param {string} message - User message
 * @returns {string} Intent type
 */
function detectIntent(message) {
  if (!message) return 'unknown';

  const text = message.toLowerCase().trim();

  // Greeting patterns
  if (/^(hi|hello|hey|greetings|namaste)/.test(text)) {
    return 'greeting';
  }

  // Help patterns
  if (/^(help|what can you do|how does this work)/.test(text)) {
    return 'help';
  }

  // Reset/New trip patterns
  if (/(new trip|start over|reset|clear)/.test(text)) {
    return 'reset';
  }

  // Goodbye patterns
  if (/^(bye|goodbye|see you|thanks|thank you)/.test(text)) {
    return 'goodbye';
  }

  // Status check
  if (/(status|progress|where are we|what do you have)/.test(text)) {
    return 'status';
  }

  // Confirmation
  if (/^(yes|yeah|sure|ok|okay|fine)/.test(text)) {
    return 'confirmation';
  }

  // Negation
  if (/^(no|nope|cancel|stop)/.test(text)) {
    return 'negation';
  }

  return 'information';
}

/**
 * Capitalizes first letter of each word
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
function capitalizeWords(str) {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

module.exports = {
  parseMessage,
  detectIntent,
  capitalizeWords
};
