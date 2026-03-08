/**
 * Travel Agent Service
 * Main orchestrator that coordinates all services to process user messages
 * and generate appropriate responses
 */

const tripStateManager = require('./tripStateManager');
const clarificationEngine = require('./clarificationEngine');
const travelComparisonService = require('./travelComparisonService');
const budgetEstimationService = require('./budgetEstimationService');
const itineraryGenerator = require('./itineraryGenerator');
const responseComposer = require('./responseComposer');

/**
 * Processes an incoming user message and generates a response
 * @param {Object} message - Normalized message object
 * @param {string} message.userId - User's WhatsApp ID
 * @param {string} message.messageText - Message content
 * @param {string} message.timestamp - Message timestamp
 * @returns {Object} Response object with text and metadata
 */
async function processMessage(message) {
  try {
    const { userId, messageText } = message;

    // Check for reset command
    if (messageText.toLowerCase() === 'new trip' || messageText.toLowerCase() === 'reset') {
      tripStateManager.clearUserState(userId);
      return {
        userId,
        text: "Let's plan a new trip! Where will you be traveling from?",
        type: 'clarification'
      };
    }

    // Get current user state
    let userState = tripStateManager.getUserState(userId);

    // Try to extract information from message
    const extractedData = extractInformation(messageText, userState);

    // Update state with any extracted information
    if (Object.keys(extractedData).length > 0) {
      userState = tripStateManager.updateUserState(userId, extractedData);
    }

    // Check if trip is complete
    const clarification = clarificationEngine.analyze(userState);

    if (!clarification.completed) {
      // More information needed
      return {
        userId,
        text: responseComposer.composeClarificationQuestion(
          clarification.question,
          userState
        ),
        type: 'clarification',
        state: userState
      };
    }

    // Trip is complete - generate full response
    return await generateCompleteResponse(userId, userState);

  } catch (error) {
    console.error('Error processing message:', error);
    return {
      userId: message.userId,
      text: "Sorry, I encountered an error. Please try again or type 'new trip' to start over.",
      type: 'error'
    };
  }
}

/**
 * Extracts travel information from user message
 * Uses simple pattern matching - no AI
 * @param {string} messageText - User's message
 * @param {Object} currentState - Current trip state
 * @returns {Object} Extracted data fields
 */
function extractInformation(messageText, currentState) {
  const extracted = {};
  const text = messageText.toLowerCase().trim();

  // Extract days (patterns: "3 days", "for 5 days", "3days")
  const daysMatch = text.match(/(\d+)\s*days?/);
  if (daysMatch && !currentState.days) {
    extracted.days = parseInt(daysMatch[1], 10);
  }

  // Extract budget (patterns: "10000 rupees", "₹5000", "budget 15000")
  const budgetMatch = text.match(/(?:₹|rs\.?|rupees?|budget\s+)\s*(\d+)/i) ||
                      text.match(/(\d{4,})\s*(?:₹|rs\.?|rupees?)?/);
  if (budgetMatch && !currentState.budget) {
    extracted.budget = parseInt(budgetMatch[1], 10);
  }

  // Extract transport preference
  const transportKeywords = {
    train: ['train', 'railway', 'rail'],
    bus: ['bus', 'road'],
    flight: ['flight', 'fly', 'airplane', 'plane', 'air']
  };

  if (!currentState.transportPreference) {
    for (const [type, keywords] of Object.entries(transportKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        extracted.transportPreference = type;
        break;
      }
    }
  }

  // Extract from/to locations
  // Pattern: "from X to Y" or "X to Y"
  const locationMatch = text.match(/(?:from\s+)?([a-z\s]+)\s+to\s+([a-z\s]+)/i);
  if (locationMatch) {
    if (!currentState.from) {
      extracted.from = capitalizeWords(locationMatch[1].trim());
    }
    if (!currentState.to) {
      extracted.to = capitalizeWords(locationMatch[2].trim());
    }
  }

  // If only one location mentioned and 'from' is missing
  if (!currentState.from && !extracted.from && !extracted.to) {
    const singleLocation = text.match(/(?:in|at|to|from)\s+([a-z\s]{3,})/i);
    if (singleLocation) {
      const location = capitalizeWords(singleLocation[1].trim());
      if (!currentState.to) {
        extracted.to = location;
      } else if (!currentState.from) {
        extracted.from = location;
      }
    }
  }

  return extracted;
}

/**
 * Generates complete travel response with all details
 * @param {string} userId - User ID
 * @param {Object} userState - Complete trip state
 * @returns {Object} Response with full travel plan
 */
async function generateCompleteResponse(userId, userState) {
  try {
    // Get travel options
    const travelOptions = travelComparisonService.getTravelOptions(
      userState.from,
      userState.to,
      userState.days,
      userState.transportPreference
    );

    // Get budget breakdown using preferred transport
    const preferredTransport = travelOptions[userState.transportPreference];
    const transportCost = preferredTransport 
      ? (preferredTransport.estimatedCostRange.roundTrip.min + preferredTransport.estimatedCostRange.roundTrip.max) / 2
      : 5000;

    const budgetBreakdown = budgetEstimationService.estimateBudget(
      transportCost,
      userState.days,
      userState.budget
    );

    // Generate itinerary
    const itinerary = await itineraryGenerator.generateItinerary(
      userState.to,
      userState.days,
      { pace: 'moderate' }
    );

    // Compose final response
    const responseText = responseComposer.composeResponse({
      destination: userState.to,
      days: userState.days,
      travelOptions,
      budgetBreakdown,
      itinerary
    });

    return {
      userId,
      text: responseText,
      type: 'complete',
      data: {
        travelOptions,
        budgetBreakdown,
        itinerary
      }
    };

  } catch (error) {
    console.error('Error generating complete response:', error);
    return {
      userId,
      text: "I have all your details but couldn't generate the full plan. Please try again.",
      type: 'error'
    };
  }
}

/**
 * Capitalizes first letter of each word
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
function capitalizeWords(str) {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

module.exports = {
  processMessage,
  extractInformation,
  generateCompleteResponse
};
