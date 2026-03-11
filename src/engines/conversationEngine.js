// Conversation Engine - Smart intent detection and routing
// Determines user intent and routes to appropriate engine

const transportEngine = require('../engines/transportEngine');
const hotelEngine = require('../engines/hotelEngine');
const itineraryEngine = require('../engines/itineraryEngine');
const budgetEngine = require('../engines/budgetEngine');

class ConversationEngine {
  constructor() {
    this.intentPatterns = {
      transport: [
        /bus|train|flight|transport|travel/i,
        /from\s+\w+\s+to\s+\w+/i,
        /\b(bus|train)\s+(from|to)\b/i,
        /options.*(?:bus|train)/i,
      ],
      hotels: [
        /hotel|stay|accommodation|lodging/i,
        /where\s+to\s+stay/i,
        /book\s+hotel/i,
      ],
      itinerary: [
        /itinerary|plan|schedule|route/i,
        /\d+\s*days?\s*(?:trip|plan|itinerary)/i,
        /what\s+to\s+visit/i,
        /places\s+to\s+see/i,
      ],
      budget: [
        /budget|cost|price|expense|estimate/i,
        /how\s+much.*(?:cost|budget)/i,
        /total.*(?:cost|expense)/i,
      ],
    };
  }

  /**
   * Detect user intent from message
   * @param {string} message - User message
   * @returns {object} - Detected intent and confidence
   */
  detectIntent(message) {
    const scores = {
      transport: 0,
      hotels: 0,
      itinerary: 0,
      budget: 0,
    };

    // Score each intent based on pattern matches
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          scores[intent] += 1;
        }
      }
    }

    // Find highest scoring intent
    let maxScore = 0;
    let detectedIntent = 'general';

    for (const [intent, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedIntent = intent;
      }
    }

    console.log(`🧠 [Conversation] Detected intent: ${detectedIntent} (confidence: ${maxScore})`);

    return {
      intent: detectedIntent,
      confidence: maxScore,
      scores: scores,
    };
  }

  /**
   * Extract entities from message (origin, destination, days, etc.)
   * @param {string} message - User message
   * @returns {object} - Extracted entities
   */
  extractEntities(message) {
    const entities = {
      origin: null,
      destination: null,
      days: null,
      people: null,
      budget: null,
    };

    // Extract "from X to Y" pattern
    const fromToPattern = /(?:from|leaving\s+from)\s+([a-zA-Z\s]+?)(?:\s+to|\s+for|\s+in)/i;
    const fromMatch = message.match(fromToPattern);
    if (fromMatch && fromMatch[1]) {
      entities.origin = fromMatch[1].trim();
    }

    // Extract destination after "to" or "in"
    const toPattern = /(?:to|towards|for)\s+([a-zA-Z\s]+?)(?:\s*,|\s*$|\s+for|\s+with)/i;
    const toMatch = message.match(toPattern);
    if (toMatch && toMatch[1]) {
      entities.destination = toMatch[1].trim();
    }

    // Extract days
    const daysPattern = /(\d+)\s*(?:days?|nights?)/i;
    const daysMatch = message.match(daysPattern);
    if (daysMatch && daysMatch[1]) {
      entities.days = parseInt(daysMatch[1]);
    }

    // Extract people count
    const peoplePattern = /(\d+)\s*(?:people|persons?|pax)/i;
    const peopleMatch = message.match(peoplePattern);
    if (peopleMatch && peopleMatch[1]) {
      entities.people = parseInt(peopleMatch[1]);
    }

    // Extract budget
    const budgetPattern = /(?:rs|₹|inr)?\s*(\d{4,})(?:\s*(?:rupees|budget|total))?/i;
    const budgetMatch = message.match(budgetPattern);
    if (budgetMatch && budgetMatch[1]) {
      entities.budget = parseInt(budgetMatch[1]);
    }

    console.log('🧠 [Conversation] Extracted entities:', entities);

    return entities;
  }

  /**
   * Process message and route to appropriate engine
   * @param {string} message - User message
   * @param {object} session - Current session state
   * @returns {Promise<string>} - Formatted response
   */
  async processMessage(message, session) {
    const { intent, confidence } = this.detectIntent(message);
    const entities = this.extractEntities(message);

    // Update session with extracted entities
    if (entities.origin) session.origin = entities.origin;
    if (entities.destination) session.destination = entities.destination;
    if (entities.days) session.days = entities.days;
    if (entities.people) session.people = entities.people;
    if (entities.budget) session.budget = entities.budget;
    session.intent = intent;

    // Route to appropriate engine
    try {
      switch (intent) {
        case 'transport':
          return await this.handleTransport(session, entities);
        
        case 'hotels':
          return await this.handleHotels(session, entities);
        
        case 'itinerary':
          return await this.handleItinerary(session, entities);
        
        case 'budget':
          return await this.handleBudget(session, entities);
        
        default:
          return this.handleGeneral(message, session);
      }
    } catch (error) {
      console.error('❌ [Conversation] Error processing message:', error.message);
      return '⚠️ Travel information temporarily unavailable. Please try again later.';
    }
  }

  async handleTransport(session, entities) {
    console.log('🚌 [Conversation] Routing to transport engine');
    
    const origin = entities.origin || session.origin;
    const destination = entities.destination || session.destination;

    if (!origin || !destination) {
      return '📍 Please provide both origin and destination cities.\n\nExample: "Bus from Hyderabad to Bangalore"';
    }

    const response = await transportEngine.getTransportOptions(origin, destination);
    return response;
  }

  async handleHotels(session, entities) {
    console.log('🏨 [Conversation] Routing to hotel engine');
    
    const destination = entities.destination || session.destination;

    if (!destination) {
      return '📍 Please provide destination city.\n\nExample: "Hotels in Hyderabad"';
    }

    const days = entities.days || session.days || 2;
    const people = entities.people || session.people || 2;

    const response = await hotelEngine.getHotelOptions(destination, days, people);
    return response;
  }

  async handleItinerary(session, entities) {
    console.log('📅 [Conversation] Routing to itinerary engine');
    
    const destination = entities.destination || session.destination;
    const days = entities.days || session.days || 3;

    if (!destination) {
      return '📍 Please provide destination city.\n\nExample: "3 day itinerary for Goa"';
    }

    const response = await itineraryEngine.generateItinerary(destination, days);
    return response;
  }

  async handleBudget(session, entities) {
    console.log('💰 [Conversation] Routing to budget engine');
    
    const destination = entities.destination || session.destination;
    const days = entities.days || session.days || 3;
    const people = entities.people || session.people || 2;

    if (!destination) {
      return '📍 Please provide destination city.\n\nExample: "Budget for Goa trip for 2 people"';
    }

    const response = await budgetEngine.calculateBudget(destination, days, people);
    return response;
  }

  handleGeneral(message, session) {
    console.log('💬 [Conversation] Handling general query');
    
    return `👋 I'm your AI travel assistant! I can help you with:

🚌 Transport options (bus/train)
🏨 Hotel recommendations
📅 Travel itineraries
💰 Budget estimates

Example queries:
• "Bus from Hyderabad to Bangalore"
• "Hotels in Goa"
• "3 day itinerary for Delhi"
• "Budget for Mumbai trip"`;
  }
}

module.exports = new ConversationEngine();
