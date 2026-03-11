// Session Manager - Track conversation state
// Manages user sessions and travel context

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Get or create session for user
   * @param {string} userId - WhatsApp user ID
   * @returns {object} - Session object
   */
  getSession(userId) {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, this.createSession());
    }
    return this.sessions.get(userId);
  }

  /**
   * Create new session with default values
   * @returns {object} - New session object
   */
  createSession() {
    return {
      origin: null,
      destination: null,
      intent: null,
      people: 2,
      budget: null,
      days: 3,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };
  }

  /**
   * Update session with new data
   * @param {string} userId - WhatsApp user ID
   * @param {object} data - Data to merge into session
   */
  updateSession(userId, data) {
    const session = this.getSession(userId);
    Object.assign(session, data);
    session.lastActivity = Date.now();
    console.log('💾 [Session] Updated:', session);
  }

  /**
   * Reset session for new travel request
   * @param {string} userId - WhatsApp user ID
   */
  resetSession(userId) {
    const session = this.getSession(userId);
    session.origin = null;
    session.destination = null;
    session.intent = null;
    session.budget = null;
    session.lastActivity = Date.now();
    console.log('🔄 [Session] Reset for new request');
  }

  /**
   * Clear session completely
   * @param {string} userId - WhatsApp user ID
   */
  clearSession(userId) {
    this.sessions.delete(userId);
    console.log('🗑️ [Session] Cleared');
  }

  /**
   * Get all active sessions (for debugging)
   * @returns {array} - Array of sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.entries()).map(([userId, session]) => ({
      userId,
      ...session,
    }));
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  cleanup() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    for (const [userId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > oneDay) {
        this.sessions.delete(userId);
        console.log(`🗑️ [Session] Cleaned up inactive session: ${userId}`);
      }
    }
  }
}

module.exports = new SessionManager();
