// Follow-Up Manager
// Manages conversational flow when trip details are missing
// Tracks which questions have been asked and generates follow-up prompts

const logger = require('../config/logger');

// Default values
const DEFAULT_PEOPLE = 1;

// Follow-up question templates
const FOLLOW_UP_QUESTIONS = {
  destination: {
    question: "📍 Where do you want to go?\n\nExample: Goa, Manali, Kerala",
    field: 'destination',
    validation: (text) => {
      // Basic validation - should be a word (city name)
      return text.trim().length >= 2 && !/\\d/.test(text);
    },
    errorMessage: "❌ Please enter a valid city name.\n\nExample: Goa",
  },
  days: {
    question: "📅 How many days is your trip?\n\nExample: 3 days",
    field: 'days',
    validation: (text) => {
      const match = text.match(/(\\d+)/);
      if (match) {
        const days = parseInt(match[1]);
        return days >= 1 && days <= 30;
      }
      return false;
    },
    errorMessage: "❌ Please enter valid number of days (1-30).\n\nExample: 3",
  },
  budget: {
    question: "💰 What's your total budget?\n\nExample: 10000 or 10k",
    field: 'budget',
    validation: (text) => {
      // Extract number (supports Indian format)
      const match = text.match(/(\\d+(?:\\.\\d+)?)(k|K|l|L)?/);
      if (match) {
        let budget = parseFloat(match[1]);
        if (match[2]) {
          budget *= (match[2].toLowerCase() === 'k') ? 1000 : 100000;
        }
        return budget >= 1000 && budget <= 10000000;
      }
      return false;
    },
    errorMessage: "❌ Please enter a valid budget (₹1000 - ₹1 Crore).\n\nExample: 10000 or 10k",
  },
  people: {
    question: "👥 How many people are traveling?\n\nExample: 2 people",
    field: 'people',
    validation: (text) => {
      const match = text.match(/(\\d+)/);
      if (match) {
        const people = parseInt(match[1]);
        return people >= 1 && people <= 50;
      }
      return false;
    },
    errorMessage: "❌ Please enter valid number of people (1-50).\n\nExample: 2",
  },
};

/**
 * Initialize follow-up state in session
 */
function initializeFollowUp(session) {
  if (!session.followUp) {
    session.followUp = {
      awaitingField: null,
      askedFields: [],
      partialTrip: {
        source: null,
        destination: null,
        days: null,
        budget: null,
        people: DEFAULT_PEOPLE,
        preferences: null,
      },
    };
  }
  
  return session.followUp;
}

/**
 * Get the next missing field to ask about
 */
function getNextMissingField(parsedTrip) {
  const priority = ['destination', 'days', 'budget'];
  
  for (const field of priority) {
    if (parsedTrip.missing.includes(field)) {
      return field;
    }
  }
  
  return null;
}

/**
 * Get follow-up question for missing field
 */
function getFollowUpQuestion(field) {
  const questionData = FOLLOW_UP_QUESTIONS[field];
  
  if (!questionData) {
    logger.error('Unknown follow-up field', { field });
    return FOLLOW_UP_QUESTIONS.destination.question;
  }
  
  return questionData.question;
}

/**
 * Check if user response is valid for the awaited field
 */
function validateFollowUpResponse(field, text) {
  const questionData = FOLLOW_UP_QUESTIONS[field];
  
  if (!questionData) {
    return { valid: false, error: 'Invalid field' };
  }
  
  const isValid = questionData.validation(text);
  
  if (!isValid) {
    return { valid: false, error: questionData.errorMessage };
  }
  
  return { valid: true };
}

/**
 * Extract value from follow-up response
 */
function extractFollowUpValue(field, text) {
  switch (field) {
    case 'destination':
      return text.trim().toLowerCase();
    
    case 'days':
      const daysMatch = text.match(/(\\d+)/);
      return daysMatch ? parseInt(daysMatch[1]) : null;
    
    case 'budget':
      const budgetMatch = text.match(/(\\d+(?:\\.\\d+)?)(k|K|l|L)?/);
      if (budgetMatch) {
        let budget = parseFloat(budgetMatch[1]);
        if (budgetMatch[2]) {
          budget *= (budgetMatch[2].toLowerCase() === 'k') ? 1000 : 100000;
        }
        return Math.round(budget);
      }
      return null;
    
    case 'people':
      const peopleMatch = text.match(/(\\d+)/);
      return peopleMatch ? parseInt(peopleMatch[1]) : DEFAULT_PEOPLE;
    
    default:
      return null;
  }
}

/**
 * Update partial trip with new field value
 */
function updatePartialTrip(session, field, value) {
  const followUp = initializeFollowUp(session);
  followUp.partialTrip[field] = value;
  
  // Mark field as asked
  if (!followUp.askedFields.includes(field)) {
    followUp.askedFields.push(field);
  }
  
  // Clear awaiting field
  followUp.awaitingField = null;
  
  logger.info('Partial trip updated', {
    field,
    value,
    partialTrip: followUp.partialTrip,
  });
  
  return followUp.partialTrip;
}

/**
 * Check if partial trip is complete
 */
function isTripComplete(partialTrip) {
  return (
    partialTrip.destination &&
    partialTrip.days &&
    partialTrip.budget &&
    partialTrip.people
  );
}

/**
 * Start follow-up conversation for missing fields
 */
function startFollowUp(session, parsedTrip) {
  const followUp = initializeFollowUp(session);
  
  // Check if we're already in follow-up mode
  if (followUp.awaitingField) {
    return {
      inFollowUp: true,
      awaitingField: followUp.awaitingField,
      question: getFollowUpQuestion(followUp.awaitingField),
    };
  }
  
  // Get next missing field
  const missingField = getNextMissingField(parsedTrip);
  
  if (!missingField) {
    // All fields present (except possibly source, which is optional)
    return {
      inFollowUp: false,
      complete: true,
      trip: parsedTrip,
    };
  }
  
  // Set awaiting field
  followUp.awaitingField = missingField;
  
  // Store partial trip
  followUp.partialTrip = {
    ...followUp.partialTrip,
    destination: parsedTrip.destination || followUp.partialTrip.destination,
    source: parsedTrip.source || followUp.partialTrip.source,
    days: parsedTrip.days || followUp.partialTrip.days,
    budget: parsedTrip.budget || followUp.partialTrip.budget,
    people: parsedTrip.people || DEFAULT_PEOPLE,
    preferences: parsedTrip.preferences || followUp.partialTrip.preferences,
  };
  
  // Mark as asked
  if (!followUp.askedFields.includes(missingField)) {
    followUp.askedFields.push(missingField);
  }
  
  logger.info('Follow-up started', {
    awaitingField: missingField,
    partialTrip: followUp.partialTrip,
  });
  
  return {
    inFollowUp: true,
    awaitingField: missingField,
    question: getFollowUpQuestion(missingField),
  };
}

/**
 * Process follow-up response
 */
function processFollowUpResponse(session, text) {
  const followUp = initializeFollowUp(session);
  
  if (!followUp.awaitingField) {
    return {
      success: false,
      error: 'Not in follow-up mode',
    };
  }
  
  const field = followUp.awaitingField;
  
  // Validate response
  const validation = validateFollowUpResponse(field, text);
  
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      retryQuestion: getFollowUpQuestion(field),
    };
  }
  
  // Extract value
  const value = extractFollowUpValue(field, text);
  
  if (value === null) {
    return {
      success: false,
      error: 'Could not extract value from response',
      retryQuestion: getFollowUpQuestion(field),
    };
  }
  
  // Update partial trip
  const partialTrip = updatePartialTrip(session, field, value);
  
  // Check if trip is now complete
  if (isTripComplete(partialTrip)) {
    followUp.awaitingField = null;
    
    logger.info('Follow-up complete - trip ready', {
      trip: partialTrip,
    });
    
    return {
      success: true,
      complete: true,
      trip: partialTrip,
    };
  }
  
  // Get next missing field
  const nextMissing = getNextMissingField({
    destination: partialTrip.destination,
    days: partialTrip.days,
    budget: partialTrip.budget,
    missing: [],
  });
  
  // Rebuild missing list
  const missing = [];
  if (!partialTrip.destination) missing.push('destination');
  if (!partialTrip.days) missing.push('days');
  if (!partialTrip.budget) missing.push('budget');
  
  const actualNextMissing = missing.find(f => !followUp.askedFields.includes(f)) || missing[0];
  
  if (actualNextMissing) {
    followUp.awaitingField = actualNextMissing;
    if (!followUp.askedFields.includes(actualNextMissing)) {
      followUp.askedFields.push(actualNextMissing);
    }
    
    return {
      success: true,
      complete: false,
      nextField: actualNextMissing,
      nextQuestion: getFollowUpQuestion(actualNextMissing),
    };
  }
  
  // Should not reach here, but just in case
  followUp.awaitingField = null;
  
  return {
    success: true,
    complete: true,
    trip: partialTrip,
  };
}

/**
 * Reset follow-up state
 */
function resetFollowUp(session) {
  session.followUp = {
    awaitingField: null,
    askedFields: [],
    partialTrip: {
      source: null,
      destination: null,
      days: null,
      budget: null,
      people: DEFAULT_PEOPLE,
      preferences: null,
    },
  };
  
  logger.info('Follow-up state reset');
}

/**
 * Get follow-up status for debugging
 */
function getFollowUpStatus(session) {
  const followUp = initializeFollowUp(session);
  
  return {
    inFollowUp: !!followUp.awaitingField,
    awaitingField: followUp.awaitingField,
    askedFields: followUp.askedFields,
    partialTrip: followUp.partialTrip,
    isComplete: isTripComplete(followUp.partialTrip),
  };
}

module.exports = {
  initializeFollowUp,
  getNextMissingField,
  getFollowUpQuestion,
  validateFollowUpResponse,
  extractFollowUpValue,
  updatePartialTrip,
  isTripComplete,
  startFollowUp,
  processFollowUpResponse,
  resetFollowUp,
  getFollowUpStatus,
  FOLLOW_UP_QUESTIONS,
  DEFAULT_PEOPLE,
};
