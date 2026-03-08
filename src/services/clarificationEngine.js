/**
 * Clarification Engine
 * Determines what information is missing from a trip state
 * and generates the next question to ask the user
 */

/**
 * Priority order for collecting trip information:
 * 1. from (origin location)
 * 2. to (destination location)
 * 3. days (number of days)
 * 4. budget (total budget)
 * 5. transportPreference (preferred mode of transport)
 */
const FIELD_PRIORITY = ['from', 'to', 'days', 'budget', 'transportPreference'];

/**
 * Question templates for each field
 */
const QUESTIONS = {
  from: "Where will you be traveling from?",
  to: "What is your destination?",
  days: "How many days is your trip?",
  budget: "What is your total budget for this trip?",
  transportPreference: "What is your preferred mode of transport? (train, bus, or flight)"
};

/**
 * Analyzes user state and determines next action
 * @param {Object} userState - Current trip state for the user
 * @returns {Object} Result object indicating completion status
 * @returns {boolean} return.completed - Whether all required info is collected
 * @returns {string} [return.question] - Next question to ask (if not completed)
 */
function analyze(userState) {
  // Validate input
  if (!userState || typeof userState !== 'object') {
    return {
      completed: false,
      question: QUESTIONS[FIELD_PRIORITY[0]]
    };
  }

  // Check each field in priority order
  for (const field of FIELD_PRIORITY) {
    if (!isFieldComplete(userState[field])) {
      return {
        completed: false,
        question: QUESTIONS[field]
      };
    }
  }

  // All fields are complete
  return {
    completed: true
  };
}

/**
 * Checks if a specific field value is considered complete
 * @param {*} value - The field value to check
 * @returns {boolean} True if field has a valid value
 */
function isFieldComplete(value) {
  // Null or undefined is incomplete
  if (value === null || value === undefined) {
    return false;
  }

  // String must be non-empty after trimming
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  // Number must be positive
  if (typeof value === 'number') {
    return value > 0;
  }

  // Any other type is considered incomplete
  return false;
}

/**
 * Gets the list of missing fields in priority order
 * @param {Object} userState - Current trip state
 * @returns {string[]} Array of missing field names
 */
function getMissingFields(userState) {
  if (!userState || typeof userState !== 'object') {
    return [...FIELD_PRIORITY];
  }

  return FIELD_PRIORITY.filter(field => !isFieldComplete(userState[field]));
}

/**
 * Gets the next missing field without generating a question
 * @param {Object} userState - Current trip state
 * @returns {string|null} Next missing field name or null if complete
 */
function getNextMissingField(userState) {
  if (!userState || typeof userState !== 'object') {
    return FIELD_PRIORITY[0];
  }

  for (const field of FIELD_PRIORITY) {
    if (!isFieldComplete(userState[field])) {
      return field;
    }
  }

  return null;
}

module.exports = {
  analyze,
  getMissingFields,
  getNextMissingField,
  FIELD_PRIORITY,
  QUESTIONS
};
