// NLP Parser - Natural Language Processing for Trip Details
// Handles various input formats and extracts trip information
// Supports Indian number formats, mixed languages, and common variations

const logger = require('../config/logger');
const translationService = require('../services/translationService');

// Common Indian city name variations and misspellings
const CITY_ALIASES = {
  'mumbai': ['bombay', 'bmbai', 'mumabi', 'mumba'],
  'delhi': ['new delhi', 'nd', 'dilli', 'delhi ncr'],
  'bangalore': ['bengaluru', 'blr', 'banglore', 'bengaluru', 'bangaluru'],
  'hyderabad': ['hyd', 'hyderbad', 'hydrabad'],
  'chennai': ['madras', 'chn', 'chenai'],
  'kolkata': ['calcutta', 'ccu', 'kolcata'],
  'goa': ['panaji', 'panjim', 'north goa', 'south goa'],
  'jaipur': ['pink city', 'jipur', 'jaiput'],
  'agra': ['taj city', 'aggra'],
  'varanasi': ['benaras', 'kashi', 'banaras', 'varanashi'],
  'manali': ['mallu', 'manali himachal'],
  'shimla': ['simla', 'shimla himachal'],
  'rishikesh': ['rishikesh uttarakhand'],
  'darjeeling': ['darjiling', 'darjeeling west bengal'],
  'udaipur': ['city of lakes', 'udaypur'],
  'jodhpur': ['blue city', 'jodhpur rajasthan'],
  'amritsar': ['amritsar punjab', 'golden temple city'],
};

// Budget indicators
const BUDGET_KEYWORDS = ['budget', 'cost', 'price', 'under', 'within', 'less than', 'upto', 'up to'];

// Duration indicators
const DURATION_KEYWORDS = ['days', 'day', 'nights', 'night', 'weekend', 'week', 'weeks'];

// People indicators
const PEOPLE_KEYWORDS = ['people', 'person', 'persons', 'pax', 'travellers', 'travelers', 'members', 'family', 'friends'];

// Travel preferences
const TRAVEL_PREFERENCES = {
  'adventure': ['adventure', 'trekking', 'hiking', 'camping', 'rafting', 'paragliding'],
  'relaxing': ['relaxing', 'peaceful', 'calm', 'beach', 'resort', 'spa', 'chill'],
  'religious': ['religious', 'temple', 'pilgrimage', 'spiritual', 'darshan', 'church', 'mosque'],
  'romantic': ['romantic', 'honeymoon', 'couple', 'candlelight', 'romance'],
  'historical': ['historical', 'heritage', 'monuments', 'fort', 'palace', 'ancient'],
  'nature': ['nature', 'wildlife', 'forest', 'national park', 'mountains', 'hills'],
  'party': ['party', 'nightlife', 'club', 'pub', 'dj', 'dance'],
};

/**
 * Parse Indian number formats
 * Converts: 10k → 10000, 1L → 100000, 1.5L → 150000
 */
function parseIndianNumber(text) {
  // Remove commas and spaces
  text = text.replace(/[, \s]/g, '');

  // Match number with suffix
  const match = text.match(/(\d+(?:\.\d+)?)(k|K|l|L|lakhs?|crores?|cr|Cr)?/i);
  
  if (!match) return null;

  let number = parseFloat(match[1]);
  const suffix = match[2]?.toLowerCase();

  // Apply multiplier based on suffix
  switch (suffix) {
    case 'k':
      number *= 1000;
      break;
    case 'l':
    case 'lakhs':
    case 'lakh':
      number *= 100000;
      break;
    case 'crores':
    case 'crore':
    case 'cr':
      number *= 10000000;
      break;
  }

  return Math.round(number);
}

/**
 * Extract all numbers from text
 */
function extractNumbers(text) {
  // Remove commas from numbers (e.g., 10,000 → 10000)
  const cleaned = text.replace(/(\d+),(\d+)/g, '$1$2');
  
  // Find all numbers (including Indian format)
  const matches = cleaned.match(/\d+(?:\.\d+)?(?:k|K|l|L|lakhs?|crores?|cr|Cr)?/gi);
  
  if (!matches) return [];

  return matches.map(match => parseIndianNumber(match)).filter(n => n !== null);
}

/**
 * Find city name in text
 */
function findCity(text) {
  const words = text.toLowerCase().split(/\s+/);
  
  // Check for multi-word cities first
  const cityNames = Object.keys(CITY_ALIASES);
  
  for (const city of cityNames) {
    if (text.toLowerCase().includes(city)) {
      return city;
    }
  }

  // Check aliases
  for (const [city, aliases] of Object.entries(CITY_ALIASES)) {
    for (const alias of aliases) {
      if (text.toLowerCase().includes(alias)) {
        return city;
      }
    }
  }

  return null;
}

/**
 * Extract source and destination cities
 */
function extractCities(text) {
  const lowerText = text.toLowerCase();
  
  // Look for "X to Y" pattern
  const toPattern = lowerText.match(/(.+?)\s+to\s+(.+)/);
  
  if (toPattern) {
    const source = findCity(toPattern[1]);
    const destination = findCity(toPattern[2]);
    
    if (source && destination) {
      return { source, destination };
    }
  }

  // Look for "from X to Y" pattern
  const fromPattern = lowerText.match(/from\s+(.+?)\s+to\s+(.+)/);
  
  if (fromPattern) {
    const source = findCity(fromPattern[1]);
    const destination = findCity(fromPattern[2]);
    
    if (source && destination) {
      return { source, destination };
    }
  }

  // Find single city
  const city = findCity(text);
  
  if (city) {
    // Check if it's source or destination based on context
    if (lowerText.includes('from') || lowerText.includes('to')) {
      if (lowerText.includes('from') && lowerText.indexOf('from') < lowerText.indexOf(city)) {
        return { source: city };
      } else {
        return { destination: city };
      }
    }
    return { destination: city };
  }

  return {};
}

/**
 * Extract duration (days)
 */
function extractDays(text) {
  const lowerText = text.toLowerCase();
  
  // Check for "weekend" (2-3 days)
  if (lowerText.includes('weekend')) {
    return 2; // Default weekend trip
  }

  // Check for "a week", "one week", or "X weeks"
  if (lowerText.includes('a week') || lowerText.includes('one week')) {
    return 7;
  }
  const weekMatch = lowerText.match(/(\d+)\s*weeks?/);
  if (weekMatch) {
    return parseInt(weekMatch[1]) * 7;
  }

  // Check for "X days" or "X day"
  const dayMatch = lowerText.match(/(\d+)\s*days?/);
  if (dayMatch) {
    return parseInt(dayMatch[1]);
  }

  // Check for "X nights"
  const nightMatch = lowerText.match(/(\d+)\s*nights?/);
  if (nightMatch) {
    return parseInt(nightMatch[1]) + 1; // Nights + 1 = Days
  }

  return null;
}

/**
 * Extract budget
 */
function extractBudget(text) {
  const lowerText = text.toLowerCase();
  const numbers = extractNumbers(text);

  // Look for budget keywords followed by number
  for (const keyword of BUDGET_KEYWORDS) {
    const pattern = new RegExp(`${keyword}\\\\s*:?\\\\s*\\\\d+`, 'i');
    const match = text.match(pattern);
    
    if (match) {
      const numMatch = match[0].match(/\d+/);
      if (numMatch) {
        return parseIndianNumber(numMatch[0]);
      }
    }
  }

  // If no keyword found, use heuristics:
  // Budget is typically the largest number (but not days or people)
  if (numbers.length > 0) {
    // Filter out small numbers (likely days/people)
    const largeNumbers = numbers.filter(n => n >= 1000);
    
    if (largeNumbers.length > 0) {
      return Math.max(...largeNumbers);
    }
    
    // If no large numbers, use the largest number
    return Math.max(...numbers);
  }

  return null;
}

/**
 * Extract number of people
 */
function extractPeople(text) {
  const lowerText = text.toLowerCase();

  // Check for explicit patterns
  const patterns = [
    /(\d+)\s*(people|person|persons|pax|travellers?|members?)/i,
    /(for|with)\s*(\d+)\s*(people|person|persons|pax)/i,
    /(\d+)\s*(people|person|persons|pax)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }

  // Look for "family" (assume 4 people)
  if (lowerText.includes('family')) {
    return 4;
  }

  // Look for "couple" (2 people)
  if (lowerText.includes('couple')) {
    return 2;
  }

  // Look for "solo" or "alone" (1 person)
  if (lowerText.includes('solo') || lowerText.includes('alone')) {
    return 1;
  }

  return null;
}

/**
 * Extract travel preferences
 */
function extractPreferences(text) {
  const lowerText = text.toLowerCase();
  const preferences = [];

  for (const [preference, keywords] of Object.entries(TRAVEL_PREFERENCES)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        preferences.push(preference);
        break;
      }
    }
  }

  return preferences.length > 0 ? preferences : null;
}

/**
 * Main parser function
 * Extracts all trip details from natural language input
 */
function parseTripDetails(text) {
  const requestId = 'parser';

  try {
    logger.debug('Parsing trip details', { text, requestId });

    const result = {
      source: null,
      destination: null,
      days: null,
      budget: null,
      people: null,
      preferences: null,
      missing: [],
      confidence: 0,
    };

    // Extract cities
    const cities = extractCities(text);
    result.source = cities.source || null;
    result.destination = cities.destination || null;

    // Extract days
    result.days = extractDays(text);

    // Extract budget
    result.budget = extractBudget(text);

    // Extract people (default to 1 if not found)
    result.people = extractPeople(text) || 1;

    // Extract preferences
    result.preferences = extractPreferences(text);

    // Determine missing fields
    if (!result.destination) {
      result.missing.push('destination');
    }
    if (!result.days) {
      result.missing.push('days');
    }
    if (!result.budget) {
      result.missing.push('budget');
    }
    // People defaults to 1, so not missing

    // Calculate confidence score
    const totalFields = 4; // destination, days, budget, people
    const foundFields = totalFields - result.missing.length;
    result.confidence = Math.round((foundFields / totalFields) * 100);

    logger.info('Trip details parsed', {
      result: {
        ...result,
        missing: result.missing,
      },
      requestId,
    });

    return result;
  } catch (err) {
    logger.error('Trip parsing error', {
      error: err.message,
      text: text?.substring(0, 100),
      requestId,
    });

    return {
      source: null,
      destination: null,
      days: null,
      budget: null,
      people: null,
      preferences: null,
      missing: ['destination', 'days', 'budget'],
      confidence: 0,
      error: 'Failed to parse trip details',
    };
  }
}

/**
 * Check if text is a command (not trip details)
 */
function isCommand(text) {
  const lowerText = text.toLowerCase().trim();
  
  const commands = [
    'hi', 'hello', 'hey', 'hii',
    'help', 'menu', 'commands',
    'transport', 'hotels', 'hotel',
    'itinerary', 'budget', 'places',
    'weather', 'food',
    '1', '2', '3', '4', '5', '6', '7', '8',
  ];

  return commands.includes(lowerText);
}

/**
 * Check if text is a greeting
 */
function isGreeting(text) {
  const lowerText = text.toLowerCase().trim();
  
  const greetings = ['hi', 'hello', 'hey', 'hii', 'helo', 'namaste', 'vanakkam'];
  
  return greetings.includes(lowerText);
}

/**
 * Parse multi-language input
 * Detects language → translates to English → parses → returns with language info
 */
async function parseMultiLanguage(message) {
  try {
    // Step 1: Detect language
    const langDetection = await translationService.detectLanguage(message);
    const { language, confidence } = langDetection;

    // Step 2: If not English, translate to English for parsing
    let englishText = message;
    if (language !== 'en' && confidence > 50) {
      englishText = await translationService.translateToEnglish(message, language);
      logger.debug('Translated message for parsing', {
        originalLang: language,
        original: message.substring(0, 50),
        translated: englishText.substring(0, 50),
      });
    }

    // Step 3: Parse using existing NLP functions
    const parsed = {
      destination: findCity(englishText),
      days: extractDays(englishText),
      budget: extractBudget(englishText),
      people: extractPeople(englishText),
      preferences: extractPreferences(englishText),
    };

    // Step 4: Check if we got useful data
    const hasData = parsed.destination || parsed.days || parsed.budget || parsed.people;

    return {
      parsed,
      hasData,
      detectedLanguage: language,
      languageConfidence: confidence,
      translatedText: englishText,
      originalText: message,
    };

  } catch (error) {
    logger.error('Multi-language parsing error', {
      error: error.message,
    });

    // Fallback to English parsing
    return {
      parsed: {
        destination: findCity(message),
        days: extractDays(message),
        budget: extractBudget(message),
        people: extractPeople(message),
        preferences: extractPreferences(message),
      },
      hasData: false,
      detectedLanguage: 'en',
      languageConfidence: 0,
      translatedText: message,
      originalText: message,
    };
  }
}

module.exports = {
  parseTripDetails,
  isCommand,
  isGreeting,
  parseIndianNumber,
  extractNumbers,
  findCity,
  extractCities,
  extractDays,
  extractBudget,
  extractPeople,
  extractPreferences,
  parseMultiLanguage,
  CITY_ALIASES,
  BUDGET_KEYWORDS,
  DURATION_KEYWORDS,
  PEOPLE_KEYWORDS,
  TRAVEL_PREFERENCES,
};
