// Response Templates
// Predefined WhatsApp-formatted responses for various scenarios

const responseTemplates = {
  /**
   * Welcome message for first-time users
   */
  welcomeFirstTime: (userName = '') => {
    const greeting = userName ? `👋 Hi ${userName}!` : '👋 Welcome!';
    
    return `${greeting} I'm your TravelBot ✈️

I'll help you plan the perfect trip! Just tell me:

📍 Where you want to go
📅 How many days
💰 Your budget
👥 Number of people

Or send:
1️⃣ Transport options
2️⃣ Hotel recommendations
3️⃣ Day-by-day itinerary
4️⃣ Budget breakdown
5️⃣ Weather info
6️⃣ Local food guide
7️⃣ Book trip

Type "help" anytime for assistance!`;
  },

  /**
   * Welcome back message for returning users
   */
  welcomeBack: (userName = '', tripCount = 0) => {
    const trips = tripCount > 0 ? ` (${tripCount} trips planned!)` : '';
    const greeting = userName ? `👋 Welcome back, ${userName}!${trips}` : `👋 Welcome back!${trips}`;
    
    return `${greeting}

Ready for your next adventure? 🌍

Send trip details like:
• "Goa 3 days 10000 2 people"
• "Plan Manali trip for 5 days"

Or choose from menu 👇`;
  },

  /**
   * Trip summary after collecting all details
   */
  tripSummary: (tripData) => {
    const { destination, days, budget, people, travelStyle } = tripData;
    
    const styleText = travelStyle ? `\n🎯 Style: ${travelStyle}` : '';
    
    return `✅ *TRIP DETAILS CONFIRMED*

📍 Destination: ${destination}
📅 Duration: ${days} days
💰 Budget: ₹${budget}
👥 People: ${people}${styleText}

What would you like to explore?

1️⃣ Transport options
2️⃣ Hotel recommendations
3️⃣ Day-by-day itinerary
4️⃣ Budget breakdown
5️⃣ Weather forecast
6️⃣ Local food guide

Reply with a number or type "help"`;
  },

  /**
   * Menu options with numbered list
   */
  menuOptions: () => {
    return `📋 *MENU OPTIONS*

1️⃣ 🚍 Transport - Get travel options
2️⃣ 🏨 Hotels - See hotel recommendations
3️⃣ 📅 Itinerary - Day-by-day plan
4️⃣ 💰 Budget - See breakdown
5️⃣ 🌤 Weather - Check forecast
6️⃣ 🍛 Food - Local food guide
7️⃣ 🎫 Booking - Book your trip

━━━━━━━━━━━━━━━━
💡 Type "reset" to start new trip
💡 Type "help" for assistance

Reply with a number (1-7)`;
  },

  /**
   * Asking for destination
   */
  askDestination: () => {
    return `📍 *Where do you want to go?*

Popular destinations:
• Goa - Beaches & parties 🏖️
• Manali - Mountains & adventure 🏔️
• Kerala - Backwaters & nature 🌴
• Rajasthan - Culture & history 🏰
• Andaman - Islands & diving 🤿

Or any city in India!

Example: "Goa"`;
  },

  /**
   * Asking for number of days
   */
  askDays: () => {
    return `📅 *How many days is your trip?*

Recommended:
• Weekend getaway: 2-3 days
• Short trip: 4-5 days
• Long vacation: 7-10 days

Example: "3 days"`;
  },

  /**
   * Asking for budget
   */
  askBudget: () => {
    return `💰 *What's your total budget?*

Budget ranges (per person):
• Budget: ₹5,000-15,000
• Mid-range: ₹15,000-30,000
• Premium: ₹30,000-50,000
• Luxury: ₹50,000+

You can say:
• "10000" or "10k"
• "Under 15000"
• "Around 20k"

Example: "10000"`;
  },

  /**
   * Asking for number of people
   */
  askPeople: () => {
    return `👥 *How many people are traveling?*

Just enter the number.

Example: "2"`;
  },

  /**
   * Error messages (friendly, with retry suggestion)
   */
  error: {
    general: () => {
      return `⚠️ Oops! Something went wrong.

Please try again or send "help" for options.`;
    },
    
    invalidInput: (message = '') => {
      return `❌ I didn't understand "${message}"

Try sending:
• "Goa 3 days 10000 2 people"
• "Plan trip to Manali"

Or type "help" for options.`;
    },
    
    serviceUnavailable: (service) => {
      return `⚠️ ${service} service is temporarily unavailable.

Please try again in a few minutes.`;
    },
    
    apiError: () => {
      return `⚠️ AI service is busy right now.

Please try again in a moment.`;
    },
  },

  /**
   * Help text
   */
  helpText: () => {
    return `📖 *HOW TO USE TRAVELBOT*

*Plan a Trip:*
Send all details in one message:
• "Goa 3 days 10000 2 people"
• "Plan Manali trip for 5 days"
• "I want to visit Kerala"

*Menu Options:*
1️⃣ Transport options
2️⃣ Hotels
3️⃣ Itinerary
4️⃣ Budget breakdown
5️⃣ Weather
6️⃣ Food guide

*Commands:*
• "menu" - Show options
• "reset" - Start new trip
• "help" - This message

*Modify Trip:*
• "Change to 5 days"
• "Make it Manali instead"
• "Budget 15000 please"

Need more help? Just ask! 😊`;
  },

  /**
   * Feedback request
   */
  feedbackRequest: () => {
    return `⭐ *How was your experience?*

Rate us 1-5 stars:
• 5 ⭐⭐⭐⭐⭐ Amazing!
• 4 ⭐⭐⭐⭐ Good
• 3 ⭐⭐⭐ Okay
• 2 ⭐⭐ Needs improvement
• 1 ⭐ Poor

Or just say:
• "Great!"
• "Not helpful"
• "Could be better"

Your feedback helps us improve! 🙏`;
  },

  /**
   * Rate limit message
   */
  rateLimit: (waitMinutes = 1) => {
    return `⏳ *Slow down there!*

You're sending messages too quickly. Please wait ${waitMinutes} minute(s) and try again.

This helps us serve everyone better. Thanks for understanding! 🙏`;
  },

  /**
   * Subscription upsell
   */
  subscriptionUpsell: () => {
    return `🌟 *Upgrade to Premium!*

Get unlimited access to:
✅ Unlimited trip planning
✅ Priority support
✅ Exclusive deals
✅ Advanced itineraries
✅ Price alerts

*Plans:*
• Basic: ₹99/month (10 trips)
• Premium: ₹299/month (Unlimited)

Reply "upgrade" to get started!`;
  },

  /**
   * Modification confirmation
   */
  modificationConfirmed: (modifications) => {
    const changes = Object.entries(modifications)
      .map(([key, value]) => {
        const labels = {
          destination: '📍 Destination',
          days: '📅 Days',
          budget: '💰 Budget',
          people: '👥 People',
        };
        return `${labels[key] || key}: ${value}`;
      })
      .join('\n');
    
    return `✅ *TRIP UPDATED*

Changes made:
${changes}

What's next?
1️⃣ Transport
2️⃣ Hotels
3️⃣ Itinerary
4️⃣ Budget`;
  },

  /**
   * Goodbye message
   */
  goodbye: () => {
    return `👋 Happy to help!

Have an amazing trip! ✈️🌍

Send "hi" anytime you need travel assistance.`;
  },

  /**
   * Loading message (for long operations)
   */
  loading: (message = 'Processing your request') => {
    return `⏳ ${message}...

This may take a moment. Please wait!`;
  },

  /**
   * No data found
   */
  noDataFound: (context = '') => {
    return `🤔 No results found${context ? ` for ${context}` : ''}.

Try different options or send "help" for assistance.`;
  },

  /**
   * Confirmation prompt
   */
  confirmation: (message, yesOption = 'Yes', noOption = 'No') => {
    return `${message}

Reply:
✅ ${yesOption}
❌ ${noOption}`;
  },
};

/**
 * Get template by name
 */
function getTemplate(name, ...args) {
  const template = responseTemplates[name];
  
  if (typeof template === 'function') {
    return template(...args);
  }
  
  if (typeof template === 'object') {
    return template;
  }
  
  return `Template not found: ${name}`;
}

module.exports = {
  responseTemplates,
  getTemplate,
};
