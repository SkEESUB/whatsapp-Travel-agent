/**
 * Travel Comparison Service
 * Provides estimated travel options between locations
 * Uses fixed heuristic values - NO real-time APIs
 */

/**
 * Base cost and duration estimates per transport type
 * These are heuristic values for estimation purposes
 */
const TRANSPORT_ESTIMATES = {
  train: {
    costPerKm: { min: 2, max: 5 },      // ₹ per km
    speedKmh: 80,                        // Average speed
    baseCost: 100,                       // Base fare
    notes: 'Comfortable, scenic routes, good for medium distances'
  },
  bus: {
    costPerKm: { min: 1, max: 3 },      // ₹ per km
    speedKmh: 60,                        // Average speed
    baseCost: 50,                        // Base fare
    notes: 'Budget-friendly, frequent departures, widely available'
  },
  flight: {
    costPerKm: { min: 5, max: 15 },     // ₹ per km
    speedKmh: 500,                       // Average speed (including airport time)
    baseCost: 2000,                      // Base fare with taxes
    notes: 'Fastest option, best for long distances, book in advance for better prices'
  }
};

/**
 * Default distance estimate when locations are unknown
 * Used for providing rough estimates
 */
const DEFAULT_DISTANCE_KM = 500;

/**
 * Generates travel comparison options
 * @param {string} from - Origin location
 * @param {string} to - Destination location
 * @param {number} days - Number of travel days
 * @param {string} transportPreference - User's preferred transport type
 * @returns {Object} Travel options with estimates
 */
function getTravelOptions(from, to, days, transportPreference) {
  // Validate inputs
  if (!from || typeof from !== 'string') {
    throw new Error('Invalid from: must be a non-empty string');
  }

  if (!to || typeof to !== 'string') {
    throw new Error('Invalid to: must be a non-empty string');
  }

  if (typeof days !== 'number' || days <= 0) {
    throw new Error('Invalid days: must be a positive number');
  }

  // Estimate distance between locations
  const estimatedDistance = estimateDistance(from, to);

  // Generate options for all transport types
  const options = {
    train: calculateOption('train', estimatedDistance, days),
    bus: calculateOption('bus', estimatedDistance, days),
    flight: calculateOption('flight', estimatedDistance, days)
  };

  // Mark preferred option if specified
  if (transportPreference && options[transportPreference]) {
    options[transportPreference].isPreferred = true;
  }

  return options;
}

/**
 * Calculates estimates for a specific transport type
 * @param {string} type - Transport type (train, bus, flight)
 * @param {number} distance - Estimated distance in km
 * @param {number} days - Number of days
 * @returns {Object} Calculated option with cost, duration, and notes
 */
function calculateOption(type, distance, days) {
  const estimates = TRANSPORT_ESTIMATES[type];

  // Calculate cost range
  const minCost = Math.round(estimates.baseCost + (distance * estimates.costPerKm.min));
  const maxCost = Math.round(estimates.baseCost + (distance * estimates.costPerKm.max));

  // Calculate duration (one-way)
  const durationHours = Math.round(distance / estimates.speedKmh);
  const durationText = formatDuration(durationHours);

  // Round-trip cost
  const roundTripMin = minCost * 2;
  const roundTripMax = maxCost * 2;

  return {
    type,
    estimatedCostRange: {
      oneWay: { min: minCost, max: maxCost },
      roundTrip: { min: roundTripMin, max: roundTripMax }
    },
    estimatedDuration: {
      oneWay: durationText,
      roundTrip: formatDuration(durationHours * 2)
    },
    notes: estimates.notes,
    isEstimate: true,
    disclaimer: 'Costs are approximate and may vary based on booking time, availability, and season'
  };
}

/**
 * Estimates distance between two locations
 * Uses a simple heuristic based on city names
 * @param {string} from - Origin location
 * @param {string} to - Destination location
 * @returns {number} Estimated distance in kilometers
 */
function estimateDistance(from, to) {
  // Normalize inputs
  const origin = from.toLowerCase().trim();
  const destination = to.toLowerCase().trim();

  // Same location
  if (origin === destination) {
    return 0;
  }

  // Common route distance database (approximate values)
  const knownDistances = {
    'delhi-mumbai': 1400,
    'mumbai-delhi': 1400,
    'delhi-bangalore': 1700,
    'bangalore-delhi': 1700,
    'delhi-chennai': 2200,
    'chennai-delhi': 2200,
    'delhi-kolkata': 1300,
    'kolkata-delhi': 1300,
    'delhi-hyderabad': 1250,
    'hyderabad-delhi': 1250,
    'delhi-pune': 1200,
    'pune-delhi': 1200,
    'delhi-jaipur': 270,
    'jaipur-delhi': 270,
    'delhi-agra': 210,
    'agra-delhi': 210,
    'delhi-chandigarh': 250,
    'chandigarh-delhi': 250,
    'mumbai-bangalore': 980,
    'bangalore-mumbai': 980,
    'mumbai-chennai': 1300,
    'chennai-mumbai': 1300,
    'mumbai-pune': 150,
    'pune-mumbai': 150,
    'mumbai-goa': 450,
    'goa-mumbai': 450,
    'bangalore-chennai': 350,
    'chennai-bangalore': 350,
    'bangalore-hyderabad': 570,
    'hyderabad-bangalore': 570,
    'bangalore-kochi': 550,
    'kochi-bangalore': 550,
    'chennai-kolkata': 1360,
    'kolkata-chennai': 1360,
    'chennai-hyderabad': 630,
    'hyderabad-chennai': 630,
    'kolkata-mumbai': 1650,
    'mumbai-kolkata': 1650,
    'hyderabad-pune': 560,
    'pune-hyderabad': 560
  };

  const routeKey = `${origin}-${destination}`;
  if (knownDistances[routeKey]) {
    return knownDistances[routeKey];
  }

  // Check for same state/region (shorter distance)
  const sameRegion = checkSameRegion(origin, destination);
  if (sameRegion) {
    return 200 + Math.floor(Math.random() * 200); // 200-400km
  }

  // Default estimate for unknown routes
  return DEFAULT_DISTANCE_KM;
}

/**
 * Checks if two locations are in the same region/state
 * @param {string} location1 - First location
 * @param {string} location2 - Second location
 * @returns {boolean} True if likely same region
 */
function checkSameRegion(location1, location2) {
  // Simple heuristic - if names share common words or are short
  const words1 = location1.split(/\s+/);
  const words2 = location2.split(/\s+/);

  for (const word of words1) {
    if (word.length > 3 && words2.includes(word)) {
      return true;
    }
  }

  return false;
}

/**
 * Formats duration in hours to human-readable string
 * @param {number} hours - Duration in hours
 * @returns {string} Formatted duration
 */
function formatDuration(hours) {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} minutes`;
  }

  if (hours < 24) {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (minutes > 0) {
      return `${wholeHours}h ${minutes}m`;
    }
    return `${wholeHours} hours`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours > 0) {
    return `${days}d ${remainingHours}h`;
  }
  return `${days} days`;
}

module.exports = {
  getTravelOptions,
  estimateDistance,
  formatDuration,
  TRANSPORT_ESTIMATES
};
