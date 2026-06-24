// Session Manager - Redis-based session management with graceful degradation
// Fixes: origin reuse, transport persistence, session carryover bugs, and scalability

const { executeCommand, isRedisConnected } = require('../config/redis');
const logger = require('../config/logger');

const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
const memoryStore = new Map(); // In-memory fallback

function getSessionKey(user) {
  return `session:${user}`;
}

/**
 * Get or create session for user
 */
async function getSession(user) {
  try {
    const sessionKey = getSessionKey(user);

    if (isRedisConnected()) {
      const sessionData = await executeCommand('get', sessionKey);
      
      if (sessionData) {
        logger.debug('Session retrieved from Redis', { user });
        return JSON.parse(sessionData);
      }
    } else if (memoryStore.has(user)) {
      logger.debug('Session retrieved from memory (fallback)', { user });
      return memoryStore.get(user);
    }

    // Default session structure
    const defaultSession = {
      trip: null,
      origin: null,
      awaitingOrigin: false,
      awaitingTransportMode: false,
    };
    
    await saveSession(user, defaultSession);
    logger.debug('New session created', { user });
    return defaultSession;

  } catch (error) {
    logger.error('Failed to get session', {
      user,
      error: error.message,
    });

    if (memoryStore.has(user)) {
      return memoryStore.get(user);
    }

    const defaultSession = {
      trip: null,
      origin: null,
      awaitingOrigin: false,
      awaitingTransportMode: false,
    };
    memoryStore.set(user, defaultSession);
    return defaultSession;
  }
}

/**
 * Save session to Redis or memory
 */
async function saveSession(user, session) {
  try {
    const sessionKey = getSessionKey(user);
    const sessionData = JSON.stringify(session);

    if (isRedisConnected()) {
      await executeCommand('setex', sessionKey, SESSION_TTL, sessionData);
      logger.debug('Session saved to Redis', { user });
    } else {
      memoryStore.set(user, session);
      logger.debug('Session saved to memory (fallback)', { user });
    }
    return true;
  } catch (error) {
    logger.error('Failed to save session', {
      user,
      error: error.message,
    });
    memoryStore.set(user, session);
    return false;
  }
}

// Reset transport session completely
function resetTransportSession(session) {
  session.origin = null;
  session.awaitingOrigin = true;
  session.awaitingTransportMode = false;
  console.log("🔄 Transport session reset");
}

// Clear transport session after response
function clearTransportSession(session) {
  session.origin = null;
  session.awaitingOrigin = false;
  session.awaitingTransportMode = false;
  console.log("🧹 Transport session cleared");
}

// Save trip details
function saveTrip(session, tripData) {
  const totalBudget = tripData.budget;
  const perPerson = Math.floor(totalBudget / tripData.people);

  session.trip = {
    destination: capitalize(tripData.destination),
    days: tripData.days,
    budget: totalBudget,
    people: tripData.people,
    perPersonBudget: perPerson,
    budgetBreakdown: {
      transport: Math.floor(totalBudget * 0.3),
      hotel: Math.floor(totalBudget * 0.4),
      food: Math.floor(totalBudget * 0.2),
      localTravel: Math.floor(totalBudget * 0.05),
      emergencyBuffer: Math.floor(totalBudget * 0.05),
    },
  };

  console.log("✅ Trip saved:", session.trip);
  return session.trip;
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

module.exports = {
  getSession,
  saveSession,
  resetTransportSession,
  clearTransportSession,
  saveTrip,
};
