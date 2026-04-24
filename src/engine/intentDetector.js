// Intent Detector - Classify user message intent
// Detects what user wants to do based on message content

const { isModification, extractModification } = require('./contextManager');

// Intent types
const INTENTS = {
  NEW_TRIP: 'NEW_TRIP',
  SELECT_OPTION: 'SELECT_OPTION',
  MODIFY_TRIP: 'MODIFY_TRIP',
  ASK_QUESTION: 'ASK_QUESTION',
  GREETING: 'GREETING',
  GOODBYE: 'GOODBYE',
  FEEDBACK: 'FEEDBACK',
  HELP: 'HELP',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Detect user intent from message
 */
function detectIntent(message, context = null) {
  if (!message || typeof message !== 'string') {
    return { intent: INTENTS.UNKNOWN, confidence: 0 };
  }
  
  const text = message.trim();
  const lower = text.toLowerCase();
  
  // Check intents in priority order
  
  // 1. Greeting (high confidence)
  const greeting = detectGreeting(lower);
  if (greeting) return greeting;
  
  // 2. Goodbye
  const goodbye = detectGoodbye(lower);
  if (goodbye) return goodbye;
  
  // 3. Help
  const help = detectHelp(lower);
  if (help) return help;
  
  // 4. Feedback
  const feedback = detectFeedback(lower);
  if (feedback) return feedback;
  
  // 5. Modify trip (if context exists and has trip data)
  if (context && context.tripData?.destination) {
    const modify = detectModifyTrip(lower, text, context);
    if (modify) return modify;
  }
  
  // 6. New trip
  const newTrip = detectNewTrip(lower);
  if (newTrip) return newTrip;
  
  // 7. Select option
  const selectOption = detectSelectOption(lower);
  if (selectOption) return selectOption;
  
  // 8. Ask question
  const askQuestion = detectAskQuestion(lower);
  if (askQuestion) return askQuestion;
  
  // 9. Unknown
  return {
    intent: INTENTS.UNKNOWN,
    confidence: 0,
    data: null,
  };
}

/**
 * Detect greeting intent
 */
function detectGreeting(lower) {
  const patterns = [
    /^(hi|hello|hey|namaste|hii|hii|good\s+(morning|afternoon|evening))/i,
    /^(hi\s+there|hello\s+there|hey\s+bot)/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lower)) {
      return {
        intent: INTENTS.GREETING,
        confidence: 95,
        data: null,
      };
    }
  }
  
  return null;
}

/**
 * Detect goodbye intent
 */
function detectGoodbye(lower) {
  const patterns = [
    /^(bye|goodbye|see\s+you|thanks|thank\s+you|done|finished)/i,
    /^(that's\s+all|that\s+is\s+all|no\s+thanks)/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lower)) {
      return {
        intent: INTENTS.GOODBYE,
        confidence: 90,
        data: null,
      };
    }
  }
  
  return null;
}

/**
 * Detect help intent
 */
function detectHelp(lower) {
  const patterns = [
    /^(help|how\s+to|how\s+does|what\s+can|options|menu|commands)/i,
    /^(how\s+do\s+i|what\s+should\s+i)/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lower)) {
      return {
        intent: INTENTS.HELP,
        confidence: 95,
        data: null,
      };
    }
  }
  
  return null;
}

/**
 * Detect feedback intent
 */
function detectFeedback(lower) {
  const patterns = [
    /^(great|awesome|excellent|perfect|amazing|good|nice)/i,
    /^(bad|terrible|awful|not\s+helpful|worst|hate)/i,
    /^(rating|rate|review|feedback)/i,
    /^[1-5]\s*(stars?|out\s+of\s+5)?$/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lower)) {
      // Extract rating if present
      const ratingMatch = lower.match(/^([1-5])/);
      
      return {
        intent: INTENTS.FEEDBACK,
        confidence: 80,
        data: {
          rating: ratingMatch ? parseInt(ratingMatch[1]) : null,
          sentiment: getSentiment(lower),
        },
      };
    }
  }
  
  return null;
}

/**
 * Detect modify trip intent
 */
function detectModifyTrip(lower, originalText, context) {
  // Check for modification patterns
  if (isModification(originalText)) {
    const modifications = extractModification(originalText);
    
    if (Object.keys(modifications).length > 0) {
      return {
        intent: INTENTS.MODIFY_TRIP,
        confidence: 85,
        data: modifications,
      };
    }
  }
  
  // Check for "change to X" pattern
  const changePatterns = [
    /change\s+(?:to\s+)?([a-z\s]+(?:days?|budget|people))/i,
    /(?:make|set)\s+(?:it\s+)?(\d+)\s*days?/i,
    /(?:budget|spend)\s+(?:of\s+)?(?:rs?|₹)?(\d+(?:,\d+)?[k]?)/i,
  ];
  
  for (const pattern of changePatterns) {
    const match = lower.match(pattern);
    if (match) {
      return {
        intent: INTENTS.MODIFY_TRIP,
        confidence: 75,
        data: extractModification(originalText),
      };
    }
  }
  
  return null;
}

/**
 * Detect new trip intent
 */
function detectNewTrip(lower) {
  const patterns = [
    /^(new\s+trip|start\s+over|plan\s+(a\s+)?trip|plan\s+trip)/i,
    /^(i\s+want\s+to\s+go|want\s+to\s+visit|planning\s+to\s+go)/i,
    /^(book\s+(a\s+)?trip|need\s+(a\s+)?trip|looking\s+for\s+(a\s+)?trip)/i,
    /^(let'?s?\s+(plan|go|visit|travel))/i,
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lower)) {
      // Try to extract destination
      const destMatch = lower.match(/(?:go|visit|travel|to)\s+([a-z\s]+)/i);
      
      return {
        intent: INTENTS.NEW_TRIP,
        confidence: 90,
        data: {
          destination: destMatch ? destMatch[1].trim() : null,
        },
      };
    }
  }
  
  return null;
}

/**
 * Detect select option intent
 */
function detectSelectOption(lower) {
  // Number selection (1-7)
  if (/^[1-7]$/.test(lower)) {
    const optionMap = {
      '1': 'transport',
      '2': 'hotels',
      '3': 'itinerary',
      '4': 'budget',
      '5': 'weather',
      '6': 'food',
      '7': 'booking',
    };
    
    return {
      intent: INTENTS.SELECT_OPTION,
      confidence: 95,
      data: {
        option: optionMap[lower],
        number: parseInt(lower),
      },
    };
  }
  
  // Text-based options
  const options = {
    transport: ['transport', 'flight', 'train', 'bus', 'travel'],
    hotels: ['hotel', 'stay', 'accommodation', 'lodging'],
    itinerary: ['itinerary', 'plan', 'schedule', 'day.?by.?day'],
    budget: ['budget', 'cost', 'price', 'expense', 'money'],
    weather: ['weather', 'temperature', 'climate', 'rain'],
    food: ['food', 'restaurant', 'eat', 'cuisine', 'dish'],
    booking: ['book', 'booking', 'reserve', 'reservation'],
    reset: ['reset', 'clear', 'start over', 'new trip'],
    help: ['help', 'menu', 'options'],
  };
  
  for (const [option, keywords] of Object.entries(options)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lower)) {
        return {
          intent: INTENTS.SELECT_OPTION,
          confidence: 85,
          data: { option },
        };
      }
    }
  }
  
  return null;
}

/**
 * Detect ask question intent
 */
function detectAskQuestion(lower) {
  const patterns = [
    /which\s+is\s+better/i,
    /is\s+(goa|manali|kerala|rajasthan)\s+safe/i,
    /what\s+should\s+i\s+(visit|see|do|eat)/i,
    /how\s+(much|long|far)/i,
    /when\s+is\s+the\s+best\s+time/i,
    /can\s+you\s+(suggest|recommend|tell)/i,
    /should\s+i\s+(go|visit|book)/i,
    /\?$/, // Ends with question mark
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(lower)) {
      return {
        intent: INTENTS.ASK_QUESTION,
        confidence: 70,
        data: {
          question: lower,
        },
      };
    }
  }
  
  return null;
}

/**
 * Get sentiment from feedback message
 */
function getSentiment(text) {
  const positive = ['great', 'awesome', 'excellent', 'perfect', 'amazing', 'good', 'nice', 'love', 'best'];
  const negative = ['bad', 'terrible', 'awful', 'worst', 'hate', 'poor', 'horrible'];
  
  const lower = text.toLowerCase();
  
  for (const word of positive) {
    if (lower.includes(word)) return 'positive';
  }
  
  for (const word of negative) {
    if (lower.includes(word)) return 'negative';
  }
  
  return 'neutral';
}

/**
 * Get intent description for logging
 */
function getIntentDescription(intent) {
  const descriptions = {
    [INTENTS.NEW_TRIP]: 'User wants to plan a new trip',
    [INTENTS.SELECT_OPTION]: 'User selected a menu option',
    [INTENTS.MODIFY_TRIP]: 'User wants to modify trip details',
    [INTENTS.ASK_QUESTION]: 'User is asking a question',
    [INTENTS.GREETING]: 'User greeted the bot',
    [INTENTS.GOODBYE]: 'User is ending conversation',
    [INTENTS.FEEDBACK]: 'User provided feedback',
    [INTENTS.HELP]: 'User requested help',
    [INTENTS.UNKNOWN]: 'Unknown intent',
  };
  
  return descriptions[intent] || 'Unknown';
}

module.exports = {
  INTENTS,
  detectIntent,
  detectGreeting,
  detectGoodbye,
  detectHelp,
  detectFeedback,
  detectModifyTrip,
  detectNewTrip,
  detectSelectOption,
  detectAskQuestion,
  getIntentDescription,
};
