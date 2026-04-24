// Session Service - Redis-based session management with graceful degradation
// Handles user sessions, trip data, conversation history, and state management

const logger = require('../config/logger');
const { getRedisClient, isRedisConnected, executeCommand } = require('../config/redis');

// Configuration
const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
const MAX_HISTORY_LENGTH = 50; // Keep last 50 interactions

// In-memory fallback (if Redis is down)
const memoryStore = new Map();

/**
 * Generate session key for Redis
 */
function getSessionKey(phoneNumber) {
  return `session:${phoneNumber}`;
}

/**
 * Create default session structure
 */
function createDefaultSession(phoneNumber) {
  const now = new Date().toISOString();
  
  return {
    phoneNumber,
    state: 'MENU',
    tripData: {
      source: '',
      destination: '',
      days: 0,
      budget: 0,
      people: 0,
      travelStyle: '',
    },
    history: [],
    createdAt: now,
    lastActiveAt: now,
    messageCount: 0,
    language: 'en',
    isPremium: false,
  };
}

/**
 * Get session from Redis or memory fallback
 */
async function getSession(phoneNumber) {
  try {
    const sessionKey = getSessionKey(phoneNumber);

    // Try Redis first
    if (isRedisConnected()) {
      const sessionData = await executeCommand('get', sessionKey);
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        logger.debug('Session retrieved from Redis', { phoneNumber });
        return session;
      }
    }

    // Fallback to memory
    if (memoryStore.has(phoneNumber)) {
      logger.debug('Session retrieved from memory (fallback)', { phoneNumber });
      return memoryStore.get(phoneNumber);
    }

    // Create new session
    const newSession = createDefaultSession(phoneNumber);
    await saveSession(phoneNumber, newSession);
    
    logger.info('New session created', { phoneNumber });
    return newSession;

  } catch (error) {
    logger.error('Failed to get session', {
      phoneNumber,
      error: error.message,
    });

    // Return or create session even on error
    if (memoryStore.has(phoneNumber)) {
      return memoryStore.get(phoneNumber);
    }

    const newSession = createDefaultSession(phoneNumber);
    memoryStore.set(phoneNumber, newSession);
    return newSession;
  }
}

/**
 * Save session to Redis or memory
 */
async function saveSession(phoneNumber, session) {
  try {
    const sessionKey = getSessionKey(phoneNumber);
    const sessionData = JSON.stringify(session);

    // Try Redis
    if (isRedisConnected()) {
      await executeCommand('setex', sessionKey, SESSION_TTL, sessionData);
      logger.debug('Session saved to Redis', { phoneNumber });
      return true;
    }

    // Fallback to memory
    memoryStore.set(phoneNumber, session);
    logger.debug('Session saved to memory (fallback)', { phoneNumber });
    return true;

  } catch (error) {
    logger.error('Failed to save session', {
      phoneNumber,
      error: error.message,
    });

    // Always save to memory as backup
    memoryStore.set(phoneNumber, session);
    return false;
  }
}

/**
 * Update session with partial data (merge)
 */
async function updateSession(phoneNumber, data) {
  try {
    const session = await getSession(phoneNumber);
    
    // Merge data
    const updatedSession = {
      ...session,
      ...data,
      lastActiveAt: new Date().toISOString(),
      messageCount: session.messageCount + 1,
    };

    await saveSession(phoneNumber, updatedSession);
    
    logger.debug('Session updated', {
      phoneNumber,
      updatedFields: Object.keys(data),
    });

    return updatedSession;

  } catch (error) {
    logger.error('Failed to update session', {
      phoneNumber,
      error: error.message,
    });
    return null;
  }
}

/**
 * Update trip data specifically
 */
async function updateTripData(phoneNumber, tripData) {
  try {
    const session = await getSession(phoneNumber);
    
    session.tripData = {
      ...session.tripData,
      ...tripData,
    };
    
    session.lastActiveAt = new Date().toISOString();

    await saveSession(phoneNumber, session);
    
    logger.info('Trip data updated', {
      phoneNumber,
      tripData,
    });

    return session;

  } catch (error) {
    logger.error('Failed to update trip data', {
      phoneNumber,
      error: error.message,
    });
    return null;
  }
}

/**
 * Set session state (for conversation flow)
 */
async function setState(phoneNumber, state) {
  try {
    const session = await getSession(phoneNumber);
    session.state = state;
    session.lastActiveAt = new Date().toISOString();

    await saveSession(phoneNumber, session);
    
    logger.debug('Session state changed', {
      phoneNumber,
      oldState: session.state,
      newState: state,
    });

    return session;

  } catch (error) {
    logger.error('Failed to set session state', {
      phoneNumber,
      state,
      error: error.message,
    });
    return null;
  }
}

/**
 * Add interaction to history
 */
async function addToHistory(phoneNumber, query, response) {
  try {
    const session = await getSession(phoneNumber);
    
    // Add new entry
    session.history.push({
      query: query?.substring(0, 500) || '', // Truncate for storage
      response: response?.substring(0, 1000) || '',
      timestamp: new Date().toISOString(),
    });

    // Keep only last N entries
    if (session.history.length > MAX_HISTORY_LENGTH) {
      session.history = session.history.slice(-MAX_HISTORY_LENGTH);
    }

    session.lastActiveAt = new Date().toISOString();

    await saveSession(phoneNumber, session);
    
    logger.debug('History updated', {
      phoneNumber,
      historyLength: session.history.length,
    });

    return session;

  } catch (error) {
    logger.error('Failed to add to history', {
      phoneNumber,
      error: error.message,
    });
    return null;
  }
}

/**
 * Reset trip data but keep user session
 */
async function resetTrip(phoneNumber) {
  try {
    const session = await getSession(phoneNumber);
    
    session.tripData = {
      source: '',
      destination: '',
      days: 0,
      budget: 0,
      people: 0,
      travelStyle: '',
    };
    
    session.state = 'MENU';
    session.lastActiveAt = new Date().toISOString();

    await saveSession(phoneNumber, session);
    
    logger.info('Trip reset', { phoneNumber });

    return session;

  } catch (error) {
    logger.error('Failed to reset trip', {
      phoneNumber,
      error: error.message,
    });
    return null;
  }
}

/**
 * Delete session completely
 */
async function deleteSession(phoneNumber) {
  try {
    const sessionKey = getSessionKey(phoneNumber);

    // Delete from Redis
    if (isRedisConnected()) {
      await executeCommand('del', sessionKey);
    }

    // Delete from memory
    memoryStore.delete(phoneNumber);
    
    logger.info('Session deleted', { phoneNumber });

    return true;

  } catch (error) {
    logger.error('Failed to delete session', {
      phoneNumber,
      error: error.message,
    });
    return false;
  }
}

/**
 * Check if session is expired
 */
async function isSessionExpired(phoneNumber) {
  try {
    const session = await getSession(phoneNumber);
    
    if (!session) {
      return true;
    }

    const lastActive = new Date(session.lastActiveAt);
    const now = new Date();
    const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);

    return hoursSinceActive >= 24;

  } catch (error) {
    logger.error('Failed to check session expiry', {
      phoneNumber,
      error: error.message,
    });
    return true; // Assume expired on error
  }
}

/**
 * Get count of active sessions (for monitoring)
 */
async function getActiveSessionCount() {
  try {
    if (isRedisConnected()) {
      const keys = await executeCommand('keys', 'session:*');
      return keys ? keys.length : 0;
    }

    // Memory fallback
    return memoryStore.size;

  } catch (error) {
    logger.error('Failed to get active session count', {
      error: error.message,
    });
    return memoryStore.size;
  }
}

/**
 * Get all active sessions (admin/debug)
 */
async function getAllSessions() {
  try {
    const sessions = [];

    if (isRedisConnected()) {
      const keys = await executeCommand('keys', 'session:*');
      
      if (keys) {
        for (const key of keys) {
          const data = await executeCommand('get', key);
          if (data) {
            sessions.push(JSON.parse(data));
          }
        }
      }
    } else {
      // Memory fallback
      for (const [phoneNumber, session] of memoryStore) {
        sessions.push(session);
      }
    }

    return sessions;

  } catch (error) {
    logger.error('Failed to get all sessions', {
      error: error.message,
    });
    return Array.from(memoryStore.values());
  }
}

/**
 * Get session statistics
 */
async function getSessionStats() {
  try {
    const sessions = await getAllSessions();
    
    const stats = {
      total: sessions.length,
      byState: {},
      byLanguage: {},
      avgMessageCount: 0,
      totalMessages: 0,
    };

    for (const session of sessions) {
      // Count by state
      stats.byState[session.state] = (stats.byState[session.state] || 0) + 1;
      
      // Count by language
      stats.byLanguage[session.language] = (stats.byLanguage[session.language] || 0) + 1;
      
      // Count messages
      stats.totalMessages += session.messageCount || 0;
    }

    stats.avgMessageCount = sessions.length > 0 
      ? Math.round(stats.totalMessages / sessions.length) 
      : 0;

    return stats;

  } catch (error) {
    logger.error('Failed to get session stats', {
      error: error.message,
    });
    return {
      total: memoryStore.size,
      byState: {},
      byLanguage: {},
      avgMessageCount: 0,
      totalMessages: 0,
    };
  }
}

/**
 * Clear expired sessions (cleanup)
 */
async function cleanupExpiredSessions() {
  try {
    const sessions = await getAllSessions();
    let cleaned = 0;

    for (const session of sessions) {
      const isExpired = await isSessionExpired(session.phoneNumber);
      
      if (isExpired) {
        await deleteSession(session.phoneNumber);
        cleaned++;
      }
    }

    logger.info('Expired sessions cleaned up', { cleaned });
    return cleaned;

  } catch (error) {
    logger.error('Failed to cleanup expired sessions', {
      error: error.message,
    });
    return 0;
  }
}

// Export all functions
module.exports = {
  getSession,
  updateSession,
  updateTripData,
  setState,
  addToHistory,
  resetTrip,
  deleteSession,
  isSessionExpired,
  getActiveSessionCount,
  getAllSessions,
  getSessionStats,
  cleanupExpiredSessions,
  SESSION_TTL,
  MAX_HISTORY_LENGTH,
};
