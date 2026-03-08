// Distance Rules Engine - Indian travel logic
// Determines appropriate transport modes based on distance

const DISTANCE_RULES = {
  SHORT: { max: 200, label: 'short_distance' },
  MEDIUM: { min: 200, max: 800, label: 'medium_distance' },
  LONG: { min: 800, label: 'long_distance' },
};

// Approximate distances between major Indian cities (km)
const CITY_DISTANCES = {
  'hyderabad-delhi': 1580,
  'hyderabad-bangalore': 575,
  'hyderabad-chennai': 630,
  'hyderabad-mumbai': 710,
  'delhi-mumbai': 1420,
  'delhi-bangalore': 2165,
  'delhi-kolkata': 1470,
  'mumbai-bangalore': 985,
  'mumbai-pune': 150,
  'bangalore-chennai': 350,
  'chennai-hyderabad': 630,
  'guntur-bangalore': 620,
  'kurnool-hyderabad': 215,
  'mumbai-goa': 585,
  'delhi-jaipur': 280,
  'bangalore-mysore': 150,
};

function getDistance(origin, destination) {
  const key = `${origin.toLowerCase()}-${destination.toLowerCase()}`;
  const reverseKey = `${destination.toLowerCase()}-${origin.toLowerCase()}`;
  
  // Check direct match
  if (CITY_DISTANCES[key]) {
    return CITY_DISTANCES[key];
  }
  
  // Check reverse match
  if (CITY_DISTANCES[reverseKey]) {
    return CITY_DISTANCES[reverseKey];
  }
  
  // Default to medium distance for unknown routes
  return 500;
}

function categorizeDistance(distance) {
  if (distance < DISTANCE_RULES.SHORT.max) {
    return DISTANCE_RULES.SHORT.label;
  } else if (distance >= DISTANCE_RULES.MEDIUM.min && distance <= DISTANCE_RULES.MEDIUM.max) {
    return DISTANCE_RULES.MEDIUM.label;
  } else {
    return DISTANCE_RULES.LONG.label;
  }
}

function getRecommendedTransport(origin, destination) {
  const distance = getDistance(origin, destination);
  const category = categorizeDistance(distance);
  
  switch (category) {
    case 'short_distance':
      return {
        preferred: 'bus',
        optional: ['train'],
        unavailable: ['flight'],
        message: '✈️ Flights are not available for short distances.',
      };
      
    case 'medium_distance':
      return {
        preferred: 'train',
        optional: ['bus', 'flight'],
        unavailable: [],
        message: null,
      };
      
    case 'long_distance':
      return {
        preferred: 'flight',
        optional: ['train'],
        unavailable: ['bus'],
        message: '🚌 Bus travel is discouraged for very long distances.',
      };
      
    default:
      return {
        preferred: 'train',
        optional: ['bus', 'flight'],
        unavailable: [],
        message: null,
      };
  }
}

function isFlightAvailable(origin, destination) {
  const distance = getDistance(origin, destination);
  return distance > DISTANCE_RULES.SHORT.max;
}

function isBusRecommended(origin, destination) {
  const distance = getDistance(origin, destination);
  return distance <= DISTANCE_RULES.MEDIUM.max;
}

module.exports = {
  getDistance,
  categorizeDistance,
  getRecommendedTransport,
  isFlightAvailable,
  isBusRecommended,
  DISTANCE_RULES,
};
