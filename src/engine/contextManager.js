// Context Manager - State Machine for Conversation Flow
// Manages conversation states, transitions, and context awareness

const logger = require('../config/logger');

// Conversation states
const STATES = {
  IDLE: 'IDLE',
  COLLECTING_DESTINATION: 'COLLECTING_DESTINATION',
  COLLECTING_DAYS: 'COLLECTING_DAYS',
  COLLECTING_BUDGET: 'COLLECTING_BUDGET',
  COLLECTING_PEOPLE: 'COLLECTING_PEOPLE',
  MENU: 'MENU',
  VIEWING_TRANSPORT: 'VIEWING_TRANSPORT',
  VIEWING_HOTELS: 'VIEWING_HOTELS',
  VIEWING_ITINERARY: 'VIEWING_ITINERARY',
  VIEWING_BUDGET: 'VIEWING_BUDGET',
  VIEWING_FOOD: 'VIEWING_FOOD',
  VIEWING_WEATHER: 'VIEWING_WEATHER',
  FEEDBACK: 'FEEDBACK',
  BOOKING: 'BOOKING',
};

// Valid state transitions
const VALID_TRANSITIONS = {
  [STATES.IDLE]: [
    STATES.COLLECTING_DESTINATION,
    STATES.MENU,
  ],
  [STATES.COLLECTING_DESTINATION]: [
    STATES.COLLECTING_DAYS,
    STATES.MENU,
    STATES.IDLE,
  ],
  [STATES.COLLECTING_DAYS]: [
    STATES.COLLECTING_BUDGET,
    STATES.COLLECTING_DESTINATION, // Go back
    STATES.MENU,
    STATES.IDLE,
  ],
  [STATES.COLLECTING_BUDGET]: [
    STATES.COLLECTING_PEOPLE,
    STATES.COLLECTING_DAYS, // Go back
    STATES.MENU,
    STATES.IDLE,
  ],
  [STATES.COLLECTING_PEOPLE]: [
    STATES.MENU,
    STATES.COLLECTING_BUDGET, // Go back
    STATES.IDLE,
  ],
  [STATES.MENU]: [
    STATES.VIEWING_TRANSPORT,
    STATES.VIEWING_HOTELS,
    STATES.VIEWING_ITINERARY,
    STATES.VIEWING_BUDGET,
    STATES.VIEWING_FOOD,
    STATES.VIEWING_WEATHER,
    STATES.COLLECTING_DESTINATION, // New trip
    STATES.IDLE,
  ],
  [STATES.VIEWING_TRANSPORT]: [STATES.MENU, STATES.IDLE],
  [STATES.VIEWING_HOTELS]: [STATES.MENU, STATES.IDLE],
  [STATES.VIEWING_ITINERARY]: [STATES.MENU, STATES.IDLE, STATES.FEEDBACK],
  [STATES.VIEWING_BUDGET]: [STATES.MENU, STATES.IDLE],
  [STATES.VIEWING_FOOD]: [STATES.MENU, STATES.IDLE],
  [STATES.VIEWING_WEATHER]: [STATES.MENU, STATES.IDLE],
  [STATES.FEEDBACK]: [STATES.MENU, STATES.IDLE],
  [STATES.BOOKING]: [STATES.MENU, STATES.IDLE],
};

/**
 * Create conversation context
 */
function createContext() {
  return {
    state: STATES.IDLE,
    tripData: {
      source: '',
      destination: '',
      days: 0,
      budget: 0,
      people: 0,
      travelStyle: '',
    },
    currentTripId: null,
    lastIntent: null,
    lastAction: null,
    conversationHistory: [],
    metadata: {},
  };
}

/**
 * Validate state transition
 */
function isValidTransition(fromState, toState) {
  const validToStates = VALID_TRANSITIONS[fromState] || [];
  return validToStates.includes(toState);
}

/**
 * Transition to new state
 */
function transition(context, newState, metadata = {}) {
  const oldState = context.state;
  
  if (!isValidTransition(oldState, newState)) {
    logger.warn('Invalid state transition', {
      from: oldState,
      to: newState,
    });
    // Allow transition anyway (flexible) but log warning
  }
  
  context.state = newState;
  context.lastAction = `transitioned from ${oldState} to ${newState}`;
  
  if (Object.keys(metadata).length > 0) {
    context.metadata = { ...context.metadata, ...metadata };
  }
  
  logger.debug('State transition', {
    from: oldState,
    to: newState,
    metadata,
  });
  
  return context;
}

/**
 * Update trip data in context
 */
function updateTripData(context, data) {
  context.tripData = {
    ...context.tripData,
    ...data,
  };
  
  context.lastAction = 'updated trip data';
  
  return context;
}

/**
 * Check if trip data is complete
 */
function isTripComplete(context) {
  const { destination, days, budget, people } = context.tripData;
  
  return !!(destination && days > 0 && budget > 0 && people > 0);
}

/**
 * Get missing fields
 */
function getMissingFields(context) {
  const missing = [];
  const { destination, days, budget, people } = context.tripData;
  
  if (!destination) missing.push('destination');
  if (!days || days <= 0) missing.push('days');
  if (!budget || budget <= 0) missing.push('budget');
  if (!people || people <= 0) missing.push('people');
  
  return missing;
}

/**
 * Reset context for new trip
 */
function resetContext(context) {
  const preservedFields = {
    conversationHistory: context.conversationHistory,
    metadata: context.metadata,
  };
  
  return {
    ...createContext(),
    conversationHistory: preservedFields.conversationHistory,
    metadata: preservedFields.metadata,
  };
}

/**
 * Add to conversation history
 */
function addToHistory(context, message, response) {
  context.conversationHistory.push({
    message: message?.substring(0, 500) || '',
    response: response?.substring(0, 1000) || '',
    timestamp: new Date().toISOString(),
    state: context.state,
  });
  
  // Keep last 20 messages
  if (context.conversationHistory.length > 20) {
    context.conversationHistory = context.conversationHistory.slice(-20);
  }
  
  return context;
}

/**
 * Determine if user is modifying existing trip
 */
function isModification(context, message) {
  const lower = message.toLowerCase();
  
  // Modification keywords
  const modificationPatterns = [
    /change\s+(to|destination|days|budget|people)/i,
    /actually/i,
    /instead/i,
    /make\s+it/i,
    /update/i,
    /modify/i,
    /switch\s+to/i,
    /different/i,
    /\d+\s+days\s+(instead|please)/i,
  ];
  
  for (const pattern of modificationPatterns) {
    if (pattern.test(lower)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract modification details from message
 */
function extractModification(message) {
  const lower = message.toLowerCase();
  const modifications = {};
  
  // Extract destination
  const destPatterns = [
    /(?:change|switch|make it|actually)\s+(?:to\s+)?([a-z\s]+)/i,
    /(?:destination|place|city)\s+(?:is\s+|to\s+|should be\s+)?([a-z\s]+)/i,
  ];
  
  for (const pattern of destPatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const dest = match[1].trim();
      if (dest.length > 1 && dest.length < 50) {
        modifications.destination = dest;
        break;
      }
    }
  }
  
  // Extract days
  const daysMatch = lower.match(/(\d+)\s*days?/i);
  if (daysMatch && daysMatch[1]) {
    const days = parseInt(daysMatch[1]);
    if (days > 0 && days <= 365) {
      modifications.days = days;
    }
  }
  
  // Extract budget
  const budgetPatterns = [
    /(\d+(?:,\d+)?)\s*(?:rs?|inr|budget)/i,
    /budget\s+(?:of\s+|is\s+|₹)?(\d+(?:,\d+)?)/i,
    /(\d+)k/i,
  ];
  
  for (const pattern of budgetPatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      let budget = parseInt(match[1].replace(/,/g, ''));
      
      // Handle "10k" format
      if (lower.includes('k') && !lower.includes('000')) {
        budget *= 1000;
      }
      
      if (budget > 0) {
        modifications.budget = budget;
        break;
      }
    }
  }
  
  // Extract people
  const peopleMatch = lower.match(/(\d+)\s*(?:people|persons|pax|travelers?)/i);
  if (peopleMatch && peopleMatch[1]) {
    const people = parseInt(peopleMatch[1]);
    if (people > 0 && people <= 100) {
      modifications.people = people;
    }
  }
  
  return modifications;
}

/**
 * Get context summary for logging
 */
function getContextSummary(context) {
  return {
    state: context.state,
    tripComplete: isTripComplete(context),
    destination: context.tripData.destination,
    days: context.tripData.days,
    budget: context.tripData.budget,
    people: context.tripData.people,
  };
}

module.exports = {
  STATES,
  VALID_TRANSITIONS,
  createContext,
  isValidTransition,
  transition,
  updateTripData,
  isTripComplete,
  getMissingFields,
  resetContext,
  addToHistory,
  isModification,
  extractModification,
  getContextSummary,
};
