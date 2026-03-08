/**
 * Application Constants
 * Centralized configuration values
 */

module.exports = {
  // Application info
  APP_NAME: 'WhatsApp AI Travel Agent',
  VERSION: '1.0.0',
  
  // Server defaults
  DEFAULT_PORT: 3000,
  
  // Trip constraints
  MIN_TRIP_DAYS: 1,
  MAX_TRIP_DAYS: 30,
  MIN_BUDGET: 1000,
  MAX_BUDGET: 10000000, // 1 Crore
  
  // WhatsApp API
  WHATSAPP_API_VERSION: 'v18.0',
  WHATSAPP_BASE_URL: 'graph.facebook.com',
  
  // OpenAI
  DEFAULT_OPENAI_MODEL: 'gpt-4',
  MAX_TOKENS: 2000,
  TEMPERATURE: 0.7,
  
  // Transport types
  TRANSPORT_TYPES: ['train', 'bus', 'flight'],
  
  // Budget allocation percentages
  BUDGET_ALLOCATION: {
    transport: 0.30,
    stay: 0.25,
    food: 0.20,
    localTravel: 0.10,
    buffer: 0.15
  },
  
  // Field priority for clarification (order matters)
  FIELD_PRIORITY: ['from', 'to', 'days', 'budget', 'transportPreference'],
  
  // Messages
  MESSAGES: {
    WELCOME: "Hello! I'm your AI Travel Assistant. Let's plan your trip! Where will you be traveling from?",
    HELP: "I can help you plan trips! Just tell me:\n- Where you want to go\n- How many days\n- Your budget\n- Preferred transport (train/bus/flight)",
    THANK_YOU: "You're welcome! Have a great trip! 🧳",
    ERROR: "Sorry, something went wrong. Please try again or type 'new trip' to start over.",
    INVALID_BUDGET: "Please provide a valid budget amount (minimum ₹1,000).",
    INVALID_DAYS: "Please provide a valid number of days (1-30).",
    TRIP_COMPLETE: "Great! I have all the details. Let me prepare your travel plan..."
  }
};
