/**
 * Trip State Manager
 * Manages user trip data in memory using JSON-based storage
 * Handles creation, retrieval, and validation of trip states
 */

// In-memory storage for user trip states
// Structure: { userId: { from, to, startDate, endDate, days, budget, transportPreference } }
const userStates = new Map();

/**
 * Gets the current trip state for a user
 * @param {string} userId - Unique identifier for the user
 * @returns {Object} User's trip state with all fields (missing fields are null)
 */
function getUserState(userId) {
  // Validate input
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }

  // Return existing state or create new empty state
  if (userStates.has(userId)) {
    return { ...userStates.get(userId) };
  }

  // Return new empty state with all fields set to null
  return createEmptyState();
}

/**
 * Updates the trip state for a user
 * @param {string} userId - Unique identifier for the user
 * @param {Object} newData - Object containing fields to update
 * @returns {Object} Updated user state
 */
function updateUserState(userId, newData) {
  // Validate input
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }

  if (!newData || typeof newData !== 'object') {
    throw new Error('Invalid newData: must be an object');
  }

  // Get current state or create new empty state
  const currentState = userStates.has(userId) 
    ? userStates.get(userId) 
    : createEmptyState();

  // Define valid fields that can be updated
  const validFields = ['from', 'to', 'startDate', 'endDate', 'days', 'budget', 'transportPreference'];

  // Update only valid fields
  const updatedState = { ...currentState };
  
  for (const field of validFields) {
    if (newData.hasOwnProperty(field)) {
      // Allow null values to clear fields, otherwise validate type
      if (newData[field] === null) {
        updatedState[field] = null;
      } else if (field === 'days' || field === 'budget') {
        // Numeric fields
        const numValue = Number(newData[field]);
        if (!isNaN(numValue) && numValue >= 0) {
          updatedState[field] = numValue;
        }
      } else if (typeof newData[field] === 'string') {
        // String fields - trim whitespace
        const trimmedValue = newData[field].trim();
        updatedState[field] = trimmedValue.length > 0 ? trimmedValue : null;
      }
    }
  }

  // Store updated state
  userStates.set(userId, updatedState);

  // Return a copy to prevent external mutation
  return { ...updatedState };
}

/**
 * Checks if a trip state is complete (all required fields filled)
 * @param {Object} userState - The user's trip state object
 * @returns {boolean} True if all required fields are filled
 */
function isTripComplete(userState) {
  // Validate input
  if (!userState || typeof userState !== 'object') {
    return false;
  }

  // Required fields for a complete trip
  const requiredFields = ['from', 'to', 'days', 'budget', 'transportPreference'];

  // Check each required field
  for (const field of requiredFields) {
    const value = userState[field];
    
    // Field is incomplete if null or undefined
    if (value === null || value === undefined) {
      return false;
    }

    // String fields must be non-empty
    if (typeof value === 'string' && value.trim().length === 0) {
      return false;
    }

    // Numeric fields must be positive
    if ((field === 'days' || field === 'budget') && (typeof value !== 'number' || value <= 0)) {
      return false;
    }
  }

  return true;
}

/**
 * Clears the trip state for a user
 * @param {string} userId - Unique identifier for the user
 * @returns {boolean} True if state was cleared, false if user had no state
 */
function clearUserState(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }

  if (userStates.has(userId)) {
    userStates.delete(userId);
    return true;
  }

  return false;
}

/**
 * Creates a new empty trip state with all fields set to null
 * @returns {Object} Empty trip state object
 */
function createEmptyState() {
  return {
    from: null,
    to: null,
    startDate: null,
    endDate: null,
    days: null,
    budget: null,
    transportPreference: null
  };
}

/**
 * Gets all active user states (for admin/debugging purposes)
 * @returns {Object} Object with userId keys and state values
 */
function getAllStates() {
  const allStates = {};
  for (const [userId, state] of userStates.entries()) {
    allStates[userId] = { ...state };
  }
  return allStates;
}

module.exports = {
  getUserState,
  updateUserState,
  isTripComplete,
  clearUserState,
  getAllStates,
  createEmptyState
};
