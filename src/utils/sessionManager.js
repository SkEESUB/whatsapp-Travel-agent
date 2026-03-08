// Session Manager - Centralized session state management
// Fixes: origin reuse, transport mode persistence, session carryover bugs

const sessions = {};

function getSession(user) {
  if (!sessions[user]) {
    sessions[user] = {
      trip: null,
      origin: null,
      awaitingOrigin: false,
      awaitingTransportMode: false,
    };
  }
  return sessions[user];
}

// CRITICAL: Reset transport session completely
function resetTransportSession(session) {
  session.origin = null;
  session.awaitingOrigin = true;
  session.awaitingTransportMode = false;
  console.log("🔄 Transport session reset");
}

// CRITICAL: Clear transport session after response
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
  resetTransportSession,
  clearTransportSession,
  saveTrip,
};
